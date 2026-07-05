import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

/**
 * WebSocket事件广播服务
 * 监听EventEmitter事件，通过Socket.IO Gateway广播给家庭房间
 *
 * 在线状态管理：
 * - MVP阶段使用内存Map存储（userId → socketId列表）
 * - 后续可迁移到Redis（支持多实例部署）
 */
@Injectable()
export class WebsocketService {
  private readonly logger = new Logger(WebsocketService.name);

  /** userId → socketId 集合（一个用户可能多端登录） */
  private userSocketMap = new Map<string, Set<string>>();

  /** socketId → userId 映射 */
  private socketUserMap = new Map<string, string>();

  /** familyId → userId 集合（在线成员） */
  private familyOnlineMap = new Map<string, Set<string>>();

  /** 广播回调函数引用（由Gateway设置） */
  private broadcastCallback: ((familyId: string, event: string, data: unknown) => void) | null = null;

  /** 单播回调函数引用 */
  private sendToUserCallback: ((userId: string, event: string, data: unknown) => void) | null = null;

  /**
   * 设置广播回调（由Gateway在初始化时调用）
   */
  setBroadcastCallback(callback: (familyId: string, event: string, data: unknown) => void): void {
    this.broadcastCallback = callback;
  }

  /**
   * 设置单播回调（由Gateway在初始化时调用）
   */
  setSendToUserCallback(callback: (userId: string, event: string, data: unknown) => void): void {
    this.sendToUserCallback = callback;
  }

  /**
   * 记录用户上线
   * @param userId 用户ID
   * @param socketId WebSocket连接ID
   * @param familyIds 用户所属的家庭ID列表
   */
  userOnline(userId: string, socketId: string, familyIds: string[]): void {
    // 记录socket映射
    if (!this.userSocketMap.has(userId)) {
      this.userSocketMap.set(userId, new Set());
    }
    this.userSocketMap.get(userId)!.add(socketId);
    this.socketUserMap.set(socketId, userId);

    // 记录家庭在线状态
    for (const familyId of familyIds) {
      if (!this.familyOnlineMap.has(familyId)) {
        this.familyOnlineMap.set(familyId, new Set());
      }
      const wasOffline = this.familyOnlineMap.get(familyId)!.size === 0;
      this.familyOnlineMap.get(familyId)!.add(userId);

      // 如果是家庭第一个上线的成员，不需要广播（没人接收）
      // 广播member:online事件给家庭房间其他成员
      if (!wasOffline) {
        this.broadcastToFamily(familyId, 'member:online', {
          userId,
          timestamp: new Date().toISOString(),
        });
      }
    }

    this.logger.log(`用户上线: ${userId}, socket: ${socketId}`);
  }

  /**
   * 记录用户下线
   * @param socketId WebSocket连接ID
   */
  userOffline(socketId: string): void {
    const userId = this.socketUserMap.get(socketId);
    if (!userId) {
      return;
    }

    // 移除socket映射
    this.socketUserMap.delete(socketId);
    const sockets = this.userSocketMap.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        // 用户所有连接都已断开
        this.userSocketMap.delete(userId);

        // 从所有家庭在线列表中移除
        for (const [familyId, onlineUsers] of this.familyOnlineMap.entries()) {
          if (onlineUsers.has(userId)) {
            onlineUsers.delete(userId);
            // 广播member:offline事件
            this.broadcastToFamily(familyId, 'member:offline', {
              userId,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    }

    this.logger.log(`用户下线: ${userId}, socket: ${socketId}`);
  }

  /**
   * 获取家庭在线成员列表
   * @param familyId 家庭ID
   * @returns 在线用户ID列表
   */
  getOnlineMembers(familyId: string): string[] {
    const onlineSet = this.familyOnlineMap.get(familyId);
    return onlineSet ? Array.from(onlineSet) : [];
  }

  /**
   * 检查用户是否在线
   * @param userId 用户ID
   * @returns 是否在线
   */
  isUserOnline(userId: string): boolean {
    const sockets = this.userSocketMap.get(userId);
    return !!sockets && sockets.size > 0;
  }

  /**
   * 广播事件到家庭房间
   * @param familyId 家庭ID
   * @param event 事件名称
   * @param data 事件数据
   */
  broadcastToFamily(familyId: string, event: string, data: unknown): void {
    if (this.broadcastCallback) {
      this.broadcastCallback(familyId, event, data);
    }
  }

  /**
   * 发送事件给指定用户
   * @param userId 用户ID
   * @param event 事件名称
   * @param data 事件数据
   */
  sendToUser(userId: string, event: string, data: unknown): void {
    if (this.sendToUserCallback) {
      this.sendToUserCallback(userId, event, data);
    }
  }

  // ==================== 事件监听（EventEmitter → WebSocket广播） ====================

  /**
   * 监听交易创建事件
   */
  @OnEvent('transaction.created')
  handleTransactionCreated(payload: {
    transaction: unknown;
    ledgerId: string;
    familyId: string;
    userId: string;
  }): void {
    this.broadcastToFamily(payload.familyId, 'transaction:created', {
      transaction: payload.transaction,
      ledgerId: payload.ledgerId,
      userId: payload.userId,
    });
  }

  /**
   * 监听交易更新事件
   */
  @OnEvent('transaction.updated')
  handleTransactionUpdated(payload: {
    transaction?: unknown;
    transactionId?: string;
    ledgerId: string;
    familyId: string;
    userId: string;
  }): void {
    this.broadcastToFamily(payload.familyId, 'transaction:updated', {
      transaction: payload.transaction,
      transactionId: payload.transactionId,
      ledgerId: payload.ledgerId,
      userId: payload.userId,
    });
  }

  /**
   * 监听交易删除事件
   */
  @OnEvent('transaction.deleted')
  handleTransactionDeleted(payload: {
    transactionId: string;
    ledgerId: string;
    familyId: string;
    userId: string;
  }): void {
    this.broadcastToFamily(payload.familyId, 'transaction:deleted', {
      transactionId: payload.transactionId,
      ledgerId: payload.ledgerId,
      userId: payload.userId,
    });
  }

  /**
   * 监听大额支出事件
   * 广播大额支出提醒给家庭所有成员（实时toast提示）
   * 注意：持久化通知由NotificationsService监听同一事件创建，
   * 并通过notification.created事件触发单独的notification:new推送
   */
  @OnEvent('transaction.large_expense')
  handleLargeExpense(payload: {
    transaction: unknown;
    familyId: string;
    userId: string;
  }): void {
    this.broadcastToFamily(payload.familyId, 'transaction:large_expense', {
      transaction: payload.transaction,
      userId: payload.userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 监听预算预警事件（由BudgetsService发出）
   * 广播预算预警给家庭所有成员（实时UI提示）
   * 注意：持久化通知由NotificationsService监听同一事件创建
   */
  @OnEvent('budget.alert')
  handleBudgetAlert(payload: {
    type: 'warning' | 'exceeded' | 'success';
    familyId: string;
    categoryId: string | null;
    categoryName: string;
    percentage: number;
    budgetAmount: number;
    spentAmount: number;
    message: string;
    year: number;
    month: number;
  }): void {
    this.broadcastToFamily(payload.familyId, 'budget:alert', {
      type: payload.type,
      categoryId: payload.categoryId,
      categoryName: payload.categoryName,
      percentage: payload.percentage,
      budgetAmount: payload.budgetAmount,
      spentAmount: payload.spentAmount,
      message: payload.message,
      year: payload.year,
      month: payload.month,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 监听导入完成事件（由Import模块发出）
   */
  @OnEvent('import.completed')
  handleImportCompleted(payload: {
    importId: string;
    familyId: string;
    userId: string;
    successCount: number;
    aiAccuracy: number;
  }): void {
    this.broadcastToFamily(payload.familyId, 'import:completed', {
      importId: payload.importId,
      successCount: payload.successCount,
      aiAccuracy: payload.aiAccuracy,
      userId: payload.userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 监听月报生成完成事件（由Report模块发出）
   */
  @OnEvent('report.ready')
  handleReportReady(payload: {
    reportId: string;
    familyId: string;
    year: number;
    month: number;
  }): void {
    this.broadcastToFamily(payload.familyId, 'report:ready', {
      reportId: payload.reportId,
      year: payload.year,
      month: payload.month,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 监听通知事件（由Notification模块发出）
   */
  @OnEvent('notification.created')
  handleNotificationCreated(payload: {
    userId: string;
    notification: unknown;
  }): void {
    this.sendToUser(payload.userId, 'notification:new', {
      notification: payload.notification,
      timestamp: new Date().toISOString(),
    });
  }
}

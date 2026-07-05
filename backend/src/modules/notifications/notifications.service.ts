import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { FamiliesService } from '../families/families.service';
import { CreateNotificationDto, QueryNotificationDto } from './dto/create-notification.dto';

/** 默认每页条数 */
const DEFAULT_PAGE_SIZE = 20;

/**
 * 通知服务
 * 核心功能：通知CRUD、分页查询、标记已读、事件监听创建通知
 *
 * 事件监听：
 * - budget.alert → 创建预算预警通知（BUDGET_WARNING / BUDGET_EXCEEDED）
 * - transaction.large_expense → 创建大额支出通知（LARGE_EXPENSE）
 *
 * 通知创建后通过EventEmitter触发notification.created事件，
 * WebSocketService监听后通过Socket.IO推送给用户
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly familiesService: FamiliesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ==================== 通知CRUD ====================

  /**
   * 创建通知（内部方法）
   * @param dto 通知信息
   * @returns 创建的通知
   */
  async createNotification(dto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type as any,
        title: dto.title,
        content: dto.content,
        data: dto.data || {},
        isRead: false,
      },
    });

    // 触发notification.created事件，WebSocketService监听后推送
    // 注意：这里不直接import WebsocketService，而是通过EventEmitter解耦
    this.eventEmitter.emit('notification.created', {
      userId: dto.userId,
      notification,
    });

    this.logger.log(
      `通知创建: user=${dto.userId}, type=${dto.type}, title=${dto.title}`,
    );

    return notification;
  }

  /**
   * 为家庭所有成员创建通知
   * @param familyId 家庭ID
   * @param type 通知类型
   * @param title 标题
   * @param content 内容
   * @param data 附加数据
   */
  async createNotificationForFamily(
    familyId: string,
    type: string,
    title: string,
    content: string,
    data?: Record<string, any>,
  ): Promise<void> {
    // 查询家庭所有成员
    const members = await this.prisma.familyMember.findMany({
      where: { familyId },
      select: { userId: true },
    });

    for (const member of members) {
      await this.createNotification({
        userId: member.userId,
        type: type as any,
        title,
        content,
        data,
      });
    }
  }

  /**
   * 获取通知列表（分页+筛选）
   * @param userId 用户ID
   * @param query 查询条件
   * @returns 通知列表 + 总数 + 未读数
   */
  async getNotifications(userId: string, query: QueryNotificationDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || DEFAULT_PAGE_SIZE;

    const where: any = { userId };

    if (query.unreadOnly) {
      where.isRead = false;
    }

    if (query.type) {
      where.type = query.type;
    }

    // 查询总数
    const total = await this.prisma.notification.count({ where });

    // 查询未读数（不受unreadOnly筛选影响，始终返回总未读数）
    const unreadCount = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    // 查询分页数据
    const items = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items,
      total,
      unreadCount,
      page,
      pageSize,
    };
  }

  /**
   * 获取未读通知数量
   * @param userId 用户ID
   * @returns 未读数量
   */
  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  /**
   * 标记通知为已读
   * @param userId 用户ID
   * @param notificationId 通知ID
   * @returns 更新后的通知
   */
  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('通知不存在');
    }

    if (notification.userId !== userId) {
      throw new NotFoundException('通知不存在');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  /**
   * 批量标记已读
   * @param userId 用户ID
   * @param ids 通知ID列表（为空表示标记全部已读）
   * @returns 更新的数量
   */
  async markAllAsRead(userId: string, ids?: string[]): Promise<{ count: number }> {
    if (ids && ids.length > 0) {
      const result = await this.prisma.notification.updateMany({
        where: { userId, id: { in: ids } },
        data: { isRead: true },
      });
      return { count: result.count };
    }

    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { count: result.count };
  }

  /**
   * 删除通知
   * @param userId 用户ID
   * @param notificationId 通知ID
   * @returns 操作结果
   */
  async deleteNotification(userId: string, notificationId: string): Promise<{ success: boolean }> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('通知不存在');
    }

    if (notification.userId !== userId) {
      throw new NotFoundException('通知不存在');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return { success: true };
  }

  // ==================== 事件监听 ====================

  /**
   * 监听预算预警事件
   * 由BudgetsService在预算检查时触发
   * 创建BUDGET_WARNING或BUDGET_EXCEEDED类型通知
   */
  @OnEvent('budget.alert')
  async handleBudgetAlert(payload: {
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
  }): Promise<void> {
    try {
      const notificationType =
        payload.type === 'exceeded'
          ? 'BUDGET_EXCEEDED' as const
          : 'BUDGET_WARNING' as const;

      const title =
        payload.type === 'exceeded'
          ? '预算超支提醒'
          : '预算预警提醒';

      await this.createNotificationForFamily(
        payload.familyId,
        notificationType,
        title,
        payload.message,
        {
          categoryId: payload.categoryId,
          categoryName: payload.categoryName,
          percentage: payload.percentage,
          budgetAmount: payload.budgetAmount,
          spentAmount: payload.spentAmount,
          year: payload.year,
          month: payload.month,
          actionUrl: '/budget',
        },
      );

      this.logger.log(
        `预算预警通知已创建: family=${payload.familyId}, type=${notificationType}, ` +
        `category=${payload.categoryName}, percentage=${payload.percentage}`,
      );
    } catch (error) {
      this.logger.error(
        `处理预算预警通知失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 监听大额支出事件
   * 由TransactionsService在创建大额支出交易时触发
   * 创建LARGE_EXPENSE类型通知
   */
  @OnEvent('transaction.large_expense')
  async handleLargeExpense(payload: {
    transaction: {
      id: string;
      amount: number | { toString(): string };
      merchant?: string | null;
      note?: string | null;
      date?: Date | string;
    };
    familyId: string;
    userId: string;
  }): Promise<void> {
    try {
      const tx = payload.transaction;
      const amount = typeof tx.amount === 'number' ? tx.amount : Number(tx.amount);
      const merchant = tx.merchant || '未知商户';
      const note = tx.note || '';

      const title = '大额支出提醒';
      const content = `检测到大额支出：${merchant} ${amount.toFixed(2)}元${note ? `（${note}）` : ''}`;

      await this.createNotificationForFamily(
        payload.familyId,
        'LARGE_EXPENSE',
        title,
        content,
        {
          transactionId: tx.id,
          amount,
          merchant,
          actionUrl: '/transactions',
        },
      );

      this.logger.log(
        `大额支出通知已创建: family=${payload.familyId}, amount=${amount}, merchant=${merchant}`,
      );
    } catch (error) {
      this.logger.error(
        `处理大额支出通知失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 监听月报生成事件
   * 创建MONTHLY_REPORT类型通知
   */
  @OnEvent('report.ready')
  async handleReportReady(payload: {
    reportId: string;
    familyId: string;
    year: number;
    month: number;
  }): Promise<void> {
    try {
      const title = `${payload.year}年${payload.month}月财务月报已生成`;
      const content = `您的${payload.year}年${payload.month}月AI财务洞察月报已生成，点击查看详情。`;

      await this.createNotificationForFamily(
        payload.familyId,
        'MONTHLY_REPORT',
        title,
        content,
        {
          reportId: payload.reportId,
          year: payload.year,
          month: payload.month,
          actionUrl: '/report',
        },
      );

      this.logger.log(
        `月报通知已创建: family=${payload.familyId}, ${payload.year}-${payload.month}`,
      );
    } catch (error) {
      this.logger.error(
        `处理月报通知失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 监听导入完成事件
   * 创建IMPORT_COMPLETE类型通知
   */
  @OnEvent('import.completed')
  async handleImportCompleted(payload: {
    importId: string;
    familyId: string;
    userId: string;
    successCount: number;
    aiAccuracy: number;
  }): Promise<void> {
    try {
      const title = '账单导入完成';
      const content = `成功导入${payload.successCount}条交易记录，AI分类准确率${Math.round(payload.aiAccuracy * 100)}%。`;

      await this.createNotificationForFamily(
        payload.familyId,
        'IMPORT_COMPLETE',
        title,
        content,
        {
          importId: payload.importId,
          successCount: payload.successCount,
          aiAccuracy: payload.aiAccuracy,
          actionUrl: '/transactions',
        },
      );

      this.logger.log(
        `导入完成通知已创建: family=${payload.familyId}, count=${payload.successCount}`,
      );
    } catch (error) {
      this.logger.error(
        `处理导入完成通知失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 监听家庭成员加入事件
   * 创建FAMILY_MEMBER_JOIN类型通知
   */
  @OnEvent('family.member_joined')
  async handleMemberJoined(payload: {
    familyId: string;
    userId: string;
    nickname: string;
  }): Promise<void> {
    try {
      const title = '新成员加入家庭';
      const content = `${payload.nickname}已加入您的家庭，可以开始共同记账了。`;

      await this.createNotificationForFamily(
        payload.familyId,
        'FAMILY_MEMBER_JOIN',
        title,
        content,
        {
          newMemberId: payload.userId,
          nickname: payload.nickname,
          actionUrl: '/family',
        },
      );

      this.logger.log(
        `成员加入通知已创建: family=${payload.familyId}, user=${payload.nickname}`,
      );
    } catch (error) {
      this.logger.error(
        `处理成员加入通知失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * WebSocket事件类型定义
 */

// ==================== 客户端 → 服务端 ====================

/** 加入家庭房间 */
export interface FamilyJoinPayload {
  familyId: string;
}

/** 离开家庭房间 */
export interface FamilyLeavePayload {
  familyId: string;
}

/** 正在输入 */
export interface TypingStartPayload {
  ledgerId: string;
}

// ==================== 服务端 → 客户端 ====================

/** 交易创建事件 */
export interface TransactionCreatedEvent {
  transaction: import('./transaction').Transaction;
  ledgerId: string;
  userId: string;
}

/** 交易更新事件 */
export interface TransactionUpdatedEvent {
  transaction: import('./transaction').Transaction;
  ledgerId: string;
  userId: string;
}

/** 交易删除事件 */
export interface TransactionDeletedEvent {
  transactionId: string;
  ledgerId: string;
  userId: string;
}

/** 成员上线事件 */
export interface MemberOnlineEvent {
  userId: string;
  nickname: string;
}

/** 成员离线事件 */
export interface MemberOfflineEvent {
  userId: string;
  nickname: string;
}

/** 预算预警事件 */
export interface BudgetAlertEvent {
  type: 'warning' | 'exceeded' | 'success';
  categoryId: string | null;
  percentage: number;
  message: string;
}

/** 新通知事件 */
export interface NotificationNewEvent {
  notification: import('./notification').Notification;
}

/** 月报生成完成事件 */
export interface ReportReadyEvent {
  reportId: string;
  year: number;
  month: number;
}

// ==================== 事件名称常量 ====================

export const WS_EVENTS = {
  // 客户端 → 服务端
  FAMILY_JOIN: 'family:join',
  FAMILY_LEAVE: 'family:leave',
  TYPING_START: 'typing:start',
  // 服务端 → 客户端
  TRANSACTION_CREATED: 'transaction:created',
  TRANSACTION_UPDATED: 'transaction:updated',
  TRANSACTION_DELETED: 'transaction:deleted',
  MEMBER_ONLINE: 'member:online',
  MEMBER_OFFLINE: 'member:offline',
  BUDGET_ALERT: 'budget:alert',
  NOTIFICATION_NEW: 'notification:new',
  REPORT_READY: 'report:ready',
} as const;

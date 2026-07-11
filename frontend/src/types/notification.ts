/**
 * 通知相关类型定义
 */

/** 通知类型枚举 */
export enum NotificationType {
  BUDGET_WARNING = 'budget_warning',
  BUDGET_EXCEEDED = 'budget_exceeded',
  BUDGET_SUCCESS = 'budget_success',
  LARGE_EXPENSE = 'large_expense',
  MONTHLY_REPORT = 'monthly_report',
  FAMILY_MEMBER_JOIN = 'member_join',
}

/** 通知记录 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  data: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

/** 通知列表响应（含未读数） */
export interface NotificationListResponse {
  items: Notification[];
  total: number;
  unreadCount: number;
}

/** Web Push订阅请求 */
export interface SubscribePushRequest {
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
}

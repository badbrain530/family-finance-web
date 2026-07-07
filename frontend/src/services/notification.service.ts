import { get, put } from './api';
import type { Notification, NotificationListResponse } from '@/types/notification';

/**
 * 通知API服务
 * 对接已有后端 notifications 模块（GET /api/notifications 等）
 * 注意：后端 NotificationType 为大写（BUDGET_WARNING...），前端枚举为小写，
 *       展示/跳转时统一以"后端原始字符串"为键（见 NotificationsPage 的大小写归一处理）
 */

/** 通知列表（分页+筛选） */
export function getNotifications(params?: {
  unreadOnly?: boolean;
  type?: string;
  page?: number;
  pageSize?: number;
}): Promise<NotificationListResponse> {
  return get<NotificationListResponse>('/notifications', params);
}

/** 未读数量 */
export function getUnreadCount(): Promise<{ count: number }> {
  return get<{ count: number }>('/notifications/unread-count');
}

/** 标记单条已读 */
export function markAsRead(id: string): Promise<Notification> {
  return put<Notification>(`/notifications/${id}/read`);
}

/** 批量标记已读（ids 为空表示全部已读） */
export function markAllAsRead(ids?: string[]): Promise<{ success: boolean }> {
  return put<{ success: boolean }>('/notifications/read-all', { ids });
}

/** 删除通知 */
export function deleteNotification(id: string): Promise<{ success: boolean }> {
  return get<{ success: boolean }>(`/notifications/${id}/delete`);
}

import { get, put } from './api';
import type { User, UpdateUserRequest, ChangePasswordRequest } from '@/types/user';

/**
 * 用户API服务
 */

/** 获取当前用户信息 */
export function getCurrentUser(): Promise<User> {
  return get<User>('/users/me');
}

/** 更新个人信息 */
export function updateUser(data: UpdateUserRequest): Promise<User> {
  return put<User>('/users/me', data);
}

/** 修改密码 */
export function changePassword(data: ChangePasswordRequest): Promise<{ success: boolean }> {
  return put('/users/password', data);
}

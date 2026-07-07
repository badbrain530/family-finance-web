import { get, post, put } from './api';
import type { Account, CreateAccountRequest, UpdateAccountRequest } from '@/types/account';

/**
 * 账户API服务
 * 路径统一相对 /accounts（后端全局前缀 /api，见 main.ts）
 */

/** 账户列表（按家庭） */
export function getAccounts(familyId: string): Promise<Account[]> {
  return get<Account[]>('/accounts', { familyId });
}

/** 账户详情 */
export function getAccount(id: string): Promise<Account> {
  return get<Account>(`/accounts/${id}`);
}

/** 新建账户 */
export function createAccount(data: CreateAccountRequest): Promise<Account> {
  return post<Account>('/accounts', data);
}

/** 编辑账户 */
export function updateAccount(id: string, data: UpdateAccountRequest): Promise<Account> {
  return put<Account>(`/accounts/${id}`, data);
}

/** 停用 / 启用账户（翻转 isActive） */
export function deactivateAccount(id: string): Promise<Account> {
  return post<Account>(`/accounts/${id}/deactivate`);
}

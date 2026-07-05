import { get, post } from './api';
import type { Ledger } from '@/types/family';

/**
 * 账本API服务
 */

/** 获取账本列表 */
export function getLedgers(familyId: string): Promise<Ledger[]> {
  return get<Ledger[]>(`/families/${familyId}/ledgers`);
}

/** 创建个人子账本 */
export function createLedger(familyId: string, name: string): Promise<Ledger> {
  return post<Ledger>(`/families/${familyId}/ledgers`, { name });
}

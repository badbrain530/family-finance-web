import { get, post } from './api';
import { LedgerType, type Ledger } from '@/types/family';

/**
 * 账本API服务
 *
 * 后端路由（全局前缀 api）：
 *   GET  /api/ledgers?familyId=xxx
 *   POST /api/ledgers  body: { familyId, name, type? }
 */

/** 获取账本列表（按 familyId 过滤） */
export function getLedgers(familyId: string): Promise<Ledger[]> {
  return get<Ledger[]>('/ledgers', { params: { familyId } });
}

/**
 * 创建账本
 * @param familyId 家庭ID（必填）
 * @param name 账本名称（必填）
 * @param type 账本类型，默认共享账本 'shared'
 */
export function createLedger(
  familyId: string,
  name: string,
  type: LedgerType = LedgerType.SHARED,
): Promise<Ledger> {
  return post<Ledger>('/ledgers', { familyId, name, type });
}

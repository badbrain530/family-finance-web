import { get, post, del } from './api';
import { LedgerType, type Ledger } from '@/types/family';

/**
 * 账本API服务
 *
 * 后端路由（全局前缀 api）：
 *   GET    /api/ledgers?familyId=xxx
 *   POST   /api/ledgers            body: { familyId, name, type? }
 *   DELETE /api/ledgers/:id        级联删除账本及其下所有账户与交易
 */

/**
 * 归一化后端返回的账本 type 字段大小写。
 *
 * 后端 Prisma 枚举为 SHARED / PERSONAL（大写），而前端 LedgerType 约定为
 * shared / personal（小写）。在此统一转换为前端约定，避免大小写不一致导致
 * 类型徽章、共享账本筛选（QuickRecordModal 中查找共享账本）等判断失效。
 * 采用大小写不敏感比较，幂等，对测试 mock 的 lowercase 同样安全。
 */
function normalizeLedger(raw: Ledger): Ledger {
  const type =
    String(raw.type).toUpperCase() === 'SHARED' ? LedgerType.SHARED : LedgerType.PERSONAL;
  return { ...raw, type };
}

/** 获取账本列表（按 familyId 过滤） */
export function getLedgers(familyId: string): Promise<Ledger[]> {
  return get<Ledger[]>('/ledgers', { params: { familyId } }).then((list) =>
    (list ?? []).map(normalizeLedger),
  );
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

/**
 * 删除账本（级联删除其下所有账户与交易）
 * @param ledgerId 账本ID
 * @returns 操作结果
 */
export function deleteLedger(ledgerId: string): Promise<{ success: boolean }> {
  return del<{ success: boolean }>(`/ledgers/${ledgerId}`);
}

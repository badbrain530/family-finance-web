import type { Transaction } from '@/types/transaction';

/**
 * 判断交易是否为「余额修改」记录。
 *
 * 余额被手动修改时由后端生成，用 metadata.balanceAdjustment=true 标记
 * （不新增 source 枚举，避免 DB migration）。该记录不应计入
 * 收入/支出汇总口径，但需在交易列表中以「余额修改」徽章展示。
 */
export function isBalanceAdjustment(tx: Transaction): boolean {
  return !!tx.metadata?.balanceAdjustment;
}

/**
 * 信用卡还款日计算工具
 *
 * 统一提供「距今天数 + 实际还款日 + 是否跨月」的结构化结果，
 * 供账户卡片 AccountsPage 与编辑表单预览 AccountFormDrawer 复用，
 * 避免在多个文件中重复实现跨月/短月兜底逻辑。
 */

/** 还款日结构化信息 */
export interface DueInfo {
  /** 距今天数 */
  days: number;
  /** 实际还款日（已按短月兜底），即 due.getDate() */
  dueDay: number;
  /** true 表示该还款日落在下个月 */
  isNextMonth: boolean;
}

/**
 * 计算信用卡还款日信息
 *
 * 规则：
 * 1. paymentDueDay 为空或 0 时返回 null；
 * 2. 短月按当月最后一天兜底（如 31 号在 2 月按 28/29 号）；
 * 3. 若今天已过了本月还款日，则把还款日推到下个月（同样按短月兜底），
 *    此时 isNextMonth 为 true；
 * 4. days 为自然日差（向上取整）。
 *
 * @param paymentDueDay 还款日（1-31），可能为空
 * @returns 结构化的还款信息，或 null
 */
export function getDueInfo(paymentDueDay: number | null): DueInfo | null {
  if (!paymentDueDay) return null;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(paymentDueDay, daysInMonth);
  let due = new Date(year, month, day);
  let isNextMonth = false;
  if (due < now) {
    const ny = month === 11 ? year + 1 : year;
    const nm = (month + 1) % 12;
    const nDays = new Date(ny, nm + 1, 0).getDate();
    due = new Date(ny, nm, Math.min(paymentDueDay, nDays));
    isNextMonth = true;
  }
  return {
    days: Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    dueDay: due.getDate(),
    isNextMonth,
  };
}

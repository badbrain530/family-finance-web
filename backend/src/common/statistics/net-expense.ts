import { PrismaService } from '../../prisma/prisma.service';

/**
 * 净支出统一计算（二期核心横切约定 §7.2）
 *
 * 唯一真源：calcNetExpense 纯函数 + sumRefundAmount / sumReimbursedAmount / sumAmortizationAmount 三个 Prisma 助手。
 * Dashboard、月报(AiReport)、预算三处必须统一调用，避免退款/报销/摊销冲减口径散落算错。
 *
 * 语义（决策③）：
 *   净支出 = 原支出 − 退款 − 报销（已 REIMBURSED 的支出）− 摊销（带 amortizationItemId 的支出）
 *  - 退款 = type=INCOME && refundOfId != null → 冲减支出（发生在哪一周期就冲减哪一周期）
 *  - 报销 = 原支出交易 reimbursementStatus='REIMBURSED' → 冲减支出（报销收入 INCOME 仍计入总收入，不在此冲减）
 *  - 摊销 = type=EXPENSE && amortizationItemId != null → 递延费用已在初始入账计入，每期摊销额从净支出中排除
 */
export function calcNetExpense(
  grossExpense: number,
  refundInScope: number,
  reimbursedInScope: number,
  amortizedInScope: number,
): number {
  const gross = grossExpense || 0;
  const refund = refundInScope || 0;
  const reimbursed = reimbursedInScope || 0;
  const amortized = amortizedInScope || 0;
  return Math.round((gross - refund - reimbursed - amortized) * 100) / 100;
}

/**
 * 聚合某家庭某时间区间内「退款金额」合计。
 * 退款 = type=INCOME && refundOfId != null && date 落在 [start, end]。
 * 通过 ledger.familyId 隔离，保证仅统计该家庭数据（§7.6）。
 */
export async function sumRefundAmount(
  prisma: PrismaService,
  familyId: string,
  start: Date,
  end: Date,
): Promise<number> {
  const result = await prisma.transaction.aggregate({
    where: {
      ledger: { familyId },
      type: 'INCOME',
      refundOfId: { not: null },
      date: { gte: start, lte: end },
    },
    _sum: { amount: true },
  });
  return Math.round((Number(result._sum.amount) || 0) * 100) / 100;
}

/**
 * 聚合某家庭某时间区间内「已报销支出金额」合计。
 * 已报销 = type=EXPENSE && reimbursementStatus='REIMBURSED' && date 落在 [start, end]。
 * 报销收入（reimbursementOfId != null）计入总收入，但原支出需从净支出冲减，故在此聚合。
 */
export async function sumReimbursedAmount(
  prisma: PrismaService,
  familyId: string,
  start: Date,
  end: Date,
): Promise<number> {
  const result = await prisma.transaction.aggregate({
    where: {
      ledger: { familyId },
      type: 'EXPENSE',
      reimbursementStatus: 'REIMBURSED',
      date: { gte: start, lte: end },
    },
    _sum: { amount: true },
  });
  return Math.round((Number(result._sum.amount) || 0) * 100) / 100;
}

/**
 * 聚合某家庭某时间区间内「摊销支出金额」合计。
 * 摊销 = type=EXPENSE && amortizationItemId != null && date 落在 [start, end]。
 * 递延费用初始入账已计入净支出，每期摊销为内部成本结转，需从净支出排除。
 */
export async function sumAmortizationAmount(
  prisma: PrismaService,
  familyId: string,
  start: Date,
  end: Date,
): Promise<number> {
  const result = await prisma.transaction.aggregate({
    where: {
      ledger: { familyId },
      type: 'EXPENSE',
      amortizationItemId: { not: null },
      date: { gte: start, lte: end },
    },
    _sum: { amount: true },
  });
  return Math.round((Number(result._sum.amount) || 0) * 100) / 100;
}

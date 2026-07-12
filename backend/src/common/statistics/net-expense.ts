import { PrismaService } from '../../prisma/prisma.service';

/**
 * 净支出统一计算（二期核心横切约定 §7.2）
 *
 * 唯一真源：calcNetExpense 纯函数 + sumRefundAmount Prisma 助手。
 * Dashboard、月报(AiReport)、预算三处必须统一调用，避免退款冲减口径散落算错。
 *
 * 语义：
 *  - 净支出 = 原支出 − 退款（退款发生在哪一周期就冲减哪一周期）
 *  - 报销收入（reimbursementOfId 不为空）计入总收入，但不冲减支出（与退款语义分离）
 */

/**
 * 计算净支出
 * @param grossExpense 周期内原始支出合计（未扣退款）
 * @param refundInScope 周期内发生的退款合计（反向 INCOME 且 refundOfId 不为空）
 * @returns 净支出（保留 2 位小数）
 */
export function calcNetExpense(grossExpense: number, refundInScope: number): number {
  const gross = grossExpense || 0;
  const refund = refundInScope || 0;
  return Math.round((gross - refund) * 100) / 100;
}

/**
 * 聚合某家庭某时间区间内「退款金额」合计。
 * 退款 = type=INCOME && refundOfId != null && date 落在 [start, end]。
 * 通过 ledger.familyId 隔离，保证仅统计该家庭数据（§7.6）。
 *
 * @param prisma PrismaService 实例
 * @param familyId 家庭ID
 * @param start 区间开始（含）
 * @param end 区间结束（含）
 * @returns 退款合计（number，保留2位）
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

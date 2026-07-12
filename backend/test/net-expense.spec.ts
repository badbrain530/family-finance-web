import { calcNetExpense, sumRefundAmount } from '../src/common/statistics/net-expense';

/**
 * 净支出统一口径（§7.2）测试
 * 三处（Dashboard / 月报 / 预算）必须统一调用：
 *  - calcNetExpense(gross, refund) 纯函数
 *  - sumRefundAmount(prisma, familyId, start, end) 聚合退款
 * 不连真实库：sumRefundAmount 用 mock prisma.transaction.aggregate。
 */
describe('net-expense 净支出统一口径', () => {
  describe('calcNetExpense 纯函数', () => {
    it('calcNetExpense(100, 30) === 70', () => {
      expect(calcNetExpense(100, 30)).toBe(70);
    });

    it('无退款时净支出等于原支出', () => {
      expect(calcNetExpense(100, 0)).toBe(100);
    });

    it('双 0 入参返回 0（避免 NaN）', () => {
      expect(calcNetExpense(0, 0)).toBe(0);
    });

    it('退款大于原支出时结果为负（保留2位）', () => {
      expect(calcNetExpense(100, 130)).toBe(-30);
    });
  });

  describe('sumRefundAmount Prisma 助手', () => {
    it('聚合 type=INCOME && refundOfId!=null 范围内金额，返回合计', async () => {
      const prisma: any = {
        transaction: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 130 } }),
        },
      };
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-31T23:59:59Z');

      const result = await sumRefundAmount(prisma, 'f1', start, end);

      expect(result).toBe(130);
      expect(prisma.transaction.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ledger: { familyId: 'f1' },
            type: 'INCOME',
            refundOfId: { not: null },
            date: { gte: start, lte: end },
          }),
          _sum: { amount: true },
        }),
      );
    });

    it('区间内无退款（_sum.amount 为 null）返回 0', async () => {
      const prisma: any = {
        transaction: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
        },
      };
      const result = await sumRefundAmount(
        prisma,
        'f1',
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-02-01T00:00:00Z'),
      );
      expect(result).toBe(0);
    });
  });
});

import {
  calcNetExpense,
  sumRefundAmount,
  sumReimbursedAmount,
  sumAmortizationAmount,
} from '../src/common/statistics/net-expense';

/**
 * 净支出统一口径（§7.2）测试
 * 三处（Dashboard / 月报 / 预算）必须统一调用：
 *  - calcNetExpense(gross, refund, reimbursed, amortized) 纯函数
 *    语义：净支出 = round((gross - refund - reimbursed - amortized) * 100) / 100
 *  - sumRefundAmount / sumReimbursedAmount / sumAmortizationAmount 三个 Prisma 助手，
 *    均按 (prisma, familyId, start, end) 在 ledger.familyId 隔离下聚合。
 * 不连真实库：用 mock prisma.transaction.aggregate。
 */
describe('net-expense 净支出统一口径', () => {
  describe('calcNetExpense 纯函数', () => {
    it('仅退款：calcNetExpense(100, 30, 0, 0) === 70', () => {
      expect(calcNetExpense(100, 30, 0, 0)).toBe(70);
    });

    it('报销冲减：calcNetExpense(100, 0, 20, 0) === 80', () => {
      expect(calcNetExpense(100, 0, 20, 0)).toBe(80);
    });

    it('摊销冲减：calcNetExpense(100, 0, 0, 15) === 85', () => {
      expect(calcNetExpense(100, 0, 0, 15)).toBe(85);
    });

    it('三者叠加：calcNetExpense(100, 30, 20, 15) === 35', () => {
      expect(calcNetExpense(100, 30, 20, 15)).toBe(35);
    });

    it('无冲减时净支出等于原支出', () => {
      expect(calcNetExpense(100, 0, 0, 0)).toBe(100);
    });

    it('双 0 入参返回 0（避免 NaN）', () => {
      expect(calcNetExpense(0, 0, 0, 0)).toBe(0);
    });

    it('退款大于原支出时结果为负（保留2位）', () => {
      expect(calcNetExpense(100, 130, 0, 0)).toBe(-30);
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

  describe('sumReimbursedAmount Prisma 助手', () => {
    it('聚合 type=EXPENSE && reimbursementStatus=REIMBURSED 范围内金额，返回合计', async () => {
      const prisma: any = {
        transaction: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 20 } }),
        },
      };
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-31T23:59:59Z');

      const result = await sumReimbursedAmount(prisma, 'f1', start, end);

      expect(result).toBe(20);
      expect(prisma.transaction.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ledger: { familyId: 'f1' },
            type: 'EXPENSE',
            reimbursementStatus: 'REIMBURSED',
            date: { gte: start, lte: end },
          }),
          _sum: { amount: true },
        }),
      );
    });

    it('区间内无报销（_sum.amount 为 null）返回 0', async () => {
      const prisma: any = {
        transaction: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
        },
      };
      const result = await sumReimbursedAmount(
        prisma,
        'f1',
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-02-01T00:00:00Z'),
      );
      expect(result).toBe(0);
    });
  });

  describe('sumAmortizationAmount Prisma 助手', () => {
    it('聚合 type=EXPENSE && amortizationItemId!=null 范围内金额，返回合计', async () => {
      const prisma: any = {
        transaction: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 15 } }),
        },
      };
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-31T23:59:59Z');

      const result = await sumAmortizationAmount(prisma, 'f1', start, end);

      expect(result).toBe(15);
      expect(prisma.transaction.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ledger: { familyId: 'f1' },
            type: 'EXPENSE',
            amortizationItemId: { not: null },
            date: { gte: start, lte: end },
          }),
          _sum: { amount: true },
        }),
      );
    });

    it('区间内无摊销（_sum.amount 为 null）返回 0', async () => {
      const prisma: any = {
        transaction: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
        },
      };
      const result = await sumAmortizationAmount(
        prisma,
        'f1',
        new Date('2024-01-01T00:00:00Z'),
        new Date('2024-02-01T00:00:00Z'),
      );
      expect(result).toBe(0);
    });
  });
});

import { AiReportService } from '../src/modules/ai/ai-report.service';

/**
 * AiReportService（P0 焦点 5 · 去 LLM 段）
 *
 * 不连真实库：PrismaService / EventEmitter2 用替身。
 * 通过把 transaction.aggregate 等净支出助手喂入 0，使聚合口径可控地等于「原支出」。
 * 重点验证：
 *   1) aggregateSummary(familyId, start, end) 返回正确结构化 SummaryResult
 *      （总收入 / 净支出 / 结余 / 分类明细 / 异常项 / 区间），纯聚合、无 LLM；
 *   2) 家庭无账本时返回全零与空数组（家族隔离安全兜底）；
 *   3) 大额单笔支出异常检测生效；
 *   4) generateMonthlyReport 的 advice 为空数组（彻底去 LLM 的硬证据）。
 */

describe('AiReportService（去 LLM 段）', () => {
  let service: AiReportService;
  let prisma: Record<string, any>;
  let eventEmitter: Record<string, any>;

  beforeEach(() => {
    prisma = {
      ledger: { findMany: jest.fn() },
      transaction: {
        findMany: jest.fn(),
        // 净支出助手（sum*）统一喂 0，使净支出 = 原支出
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
      monthlyReport: { upsert: jest.fn() },
    };
    eventEmitter = { emit: jest.fn() };
    service = new AiReportService(prisma as any, eventEmitter as any);
  });

  afterEach(() => jest.clearAllMocks());

  /** 区分「主交易查询」与「退款查询」（后者带 refundOfId），分别返回数据 / 空 */
  function mockTransactions(txns: any[]) {
    prisma.transaction.findMany.mockImplementation((args: any) =>
      args?.where?.refundOfId ? Promise.resolve([]) : Promise.resolve(txns),
    );
  }

  it('aggregateSummary 返回正确结构化汇总（纯聚合，无 LLM）', async () => {
    const start = new Date('2025-06-01T00:00:00.000Z');
    const end = new Date('2025-07-01T00:00:00.000Z');
    const txns = [
      { id: 't1', type: 'INCOME', amount: 1000, date: new Date('2025-06-10'), categoryId: null, category: null, refundOfId: null },
      { id: 't2', type: 'EXPENSE', amount: 300, date: new Date('2025-06-11'), categoryId: 'cat-1', category: { name: '餐饮' }, refundOfId: null },
      { id: 't3', type: 'EXPENSE', amount: 200, date: new Date('2025-06-12'), categoryId: 'cat-1', category: { name: '餐饮' }, refundOfId: null },
    ];
    prisma.ledger.findMany.mockResolvedValue([{ id: 'ledger-1' }]);
    mockTransactions(txns);

    const result = await service.aggregateSummary('fam-1', start, end);

    expect(result.totalIncome).toBe(1000);
    expect(result.totalExpense).toBe(500);
    expect(result.balance).toBe(500);
    expect(result.categoryBreakdown).toHaveLength(1);
    expect(result.categoryBreakdown[0]).toMatchObject({
      categoryId: 'cat-1',
      categoryName: '餐饮',
      amount: 500,
      transactionCount: 2,
      percentage: 100,
    });
    expect(result.anomalies).toEqual([]);
    expect(result.period.start).toBe(start.toISOString());
    expect(result.period.end).toBe(end.toISOString());
  });

  it('家庭无账本时返回全零与空数组（家族隔离安全兜底）', async () => {
    prisma.ledger.findMany.mockResolvedValue([]);

    const result = await service.aggregateSummary(
      'fam-x',
      new Date('2025-06-01'),
      new Date('2025-07-01'),
    );

    expect(result.totalIncome).toBe(0);
    expect(result.totalExpense).toBe(0);
    expect(result.balance).toBe(0);
    expect(result.categoryBreakdown).toEqual([]);
    expect(result.anomalies).toEqual([]);
  });

  it('检测大额单笔支出异常（large_single）', async () => {
    const txns = [
      { id: 't1', type: 'EXPENSE', amount: 1500, date: new Date('2025-06-10'), categoryId: 'cat-2', category: { name: '数码' }, refundOfId: null },
    ];
    prisma.ledger.findMany.mockResolvedValue([{ id: 'ledger-1' }]);
    mockTransactions(txns);

    const result = await service.aggregateSummary(
      'fam-1',
      new Date('2025-06-01'),
      new Date('2025-07-01'),
    );

    expect(result.anomalies.some((a) => a.type === 'large_single')).toBe(true);
  });

  it('generateMonthlyReport 去 LLM：advice 为空数组', async () => {
    const txns = [
      { id: 't1', type: 'INCOME', amount: 1000, date: new Date('2025-06-10'), categoryId: null, category: null, refundOfId: null },
      { id: 't2', type: 'EXPENSE', amount: 300, date: new Date('2025-06-11'), categoryId: 'cat-1', category: { name: '餐饮' }, refundOfId: null },
    ];
    prisma.ledger.findMany.mockResolvedValue([{ id: 'ledger-1' }]);
    mockTransactions(txns);
    prisma.monthlyReport.upsert.mockImplementation((args: any) =>
      Promise.resolve({ ...args.create, id: 'report-1' }),
    );

    const report = await service.generateMonthlyReport('fam-1', 2025, 6);

    expect(report).toBeDefined();
    expect(Array.isArray(report.advice)).toBe(true);
    expect(report.advice).toHaveLength(0); // 彻底无 LLM 文案
    expect(eventEmitter.emit).toHaveBeenCalledWith('report.ready', expect.any(Object));
  });
});

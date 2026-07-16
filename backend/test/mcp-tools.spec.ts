import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { mcpContextStorage, McpContext } from '../src/modules/mcp/mcp.context';
import { registerCreateTransactionTool } from '../src/modules/mcp/tools/create-transaction.tool';
import { registerGetTransactionsTool } from '../src/modules/mcp/tools/get-transactions.tool';
import { registerGetSummaryTool } from '../src/modules/mcp/tools/get-summary.tool';
import type { McpToolDeps } from '../src/modules/mcp/mcp.types';

/**
 * MCP 三个核心工具的协议适配单元测试（P0 焦点 3/4/5）
 *
 * 不连真实库：所有依赖 service 用对象替身注入。
 * 用「假的 McpServer」捕获 registerTool 的 handler，并在 mcpContextStorage.run(ctx)
 * 中调用，从而验证：
 *   - createTransaction：解析默认账本 + 匹配 categoryName→categoryId + source 强制 'agent' +
 *     familyId 来自 ctx；readonly 作用域被 assertWritable 拒绝；
 *   - getTransactions：familyId 来自 ctx、过滤条件构造正确；
 *   - getSummary：调用 aggregateSummary(familyId,...) 且返回纯结构化数据（彻底无 LLM 文案）。
 */

function makeFakeServer() {
  const handlers: Record<string, (args: any) => any> = {};
  const server: any = {
    registerTool: (name: string, _meta: unknown, handler: (args: any) => any) => {
      handlers[name] = handler;
    },
  };
  return { server, handlers };
}

describe('MCP Tools', () => {
  let handlers: Record<string, (args: any) => any>;
  let deps: McpToolDeps;
  let transactionsService: Record<string, any>;
  let ledgersService: Record<string, any>;
  let categoriesService: Record<string, any>;
  let aiReportService: Record<string, any>;

  const CTX_RW: McpContext = {
    apiKeyId: 'k1',
    userId: 'u1',
    familyId: 'fam-1',
    scope: 'READWRITE',
  };
  const CTX_RO: McpContext = { ...CTX_RW, scope: 'READONLY' };

  beforeEach(() => {
    transactionsService = {
      createTransaction: jest.fn(),
      getTransactions: jest.fn(),
    };
    ledgersService = { getDefaultLedger: jest.fn() };
    categoriesService = { matchCategoryByKeyword: jest.fn() };
    aiReportService = { aggregateSummary: jest.fn() };

    deps = {
      transactionsService: transactionsService as any,
      ledgersService: ledgersService as any,
      categoriesService: categoriesService as any,
      aiReportService: aiReportService as any,
    };

    const { server, handlers: h } = makeFakeServer();
    handlers = h;
    registerCreateTransactionTool(server, deps);
    registerGetTransactionsTool(server, deps);
    registerGetSummaryTool(server, deps);
  });

  afterEach(() => jest.clearAllMocks());

  // ============ 焦点 3：createTransaction ============
  describe('createTransaction', () => {
    it('解析默认账本 + 匹配分类 + source=agent + familyId 来自 ctx', async () => {
      ledgersService.getDefaultLedger.mockResolvedValue({ id: 'ledger-default' });
      categoriesService.matchCategoryByKeyword.mockResolvedValue({
        categoryId: 'cat-1',
        confidence: 0.9,
      });
      transactionsService.createTransaction.mockResolvedValue({
        id: 'tx-1',
        ledgerId: 'ledger-default',
        type: 'EXPENSE',
        amount: 35,
        date: new Date('2025-07-15T12:00:00Z'),
        merchant: null,
        note: '买肉',
        categoryId: 'cat-1',
        category: { name: '餐饮' },
        source: 'AGENT',
        createdAt: new Date('2025-07-15T12:00:00Z'),
      });

      const args = {
        amount: 35,
        type: 'expense',
        categoryName: '餐饮',
        note: '买肉',
      };

      const result: any = await mcpContextStorage.run(CTX_RW, () =>
        handlers['createTransaction'](args),
      );

      // ① 调了 getDefaultLedger 拿默认账本，且 familyId 来自 ctx
      expect(ledgersService.getDefaultLedger).toHaveBeenCalledWith('fam-1');

      // ③ categoryName 经匹配落到 categoryId
      expect(categoriesService.matchCategoryByKeyword).toHaveBeenCalledWith('fam-1', '餐饮');

      // ② 调了 createTransaction，且 source 强制 'agent'、familyId 来自 ctx（userId）
      expect(transactionsService.createTransaction).toHaveBeenCalledTimes(1);
      const [uid, dto] = transactionsService.createTransaction.mock.calls[0];
      expect(uid).toBe('u1');
      expect(dto.ledgerId).toBe('ledger-default');
      expect(dto.source).toBe('agent');
      expect(dto.categoryId).toBe('cat-1');
      expect(dto.type).toBe('expense');
      expect(dto.amount).toBe(35);
      expect(dto.note).toBe('买肉');

      // 返回结构正确（序列化后）
      const payload = JSON.parse(result.content[0].text);
      expect(payload.id).toBe('tx-1');
      expect(payload.source).toBe('agent');
      expect(payload.type).toBe('expense');
      expect(payload.categoryId).toBe('cat-1');
    });

    it('readonly 作用域调用 createTransaction 被 assertWritable 拒绝', async () => {
      const args = { amount: 35, type: 'expense' };

      await expect(
        mcpContextStorage.run(CTX_RO, () => handlers['createTransaction'](args)),
      ).rejects.toThrow(McpError);

      // 拒绝后不应触碰任何业务 service
      expect(ledgersService.getDefaultLedger).not.toHaveBeenCalled();
      expect(transactionsService.createTransaction).not.toHaveBeenCalled();
    });

    it('未提供 categoryName 时 categoryId 为 null', async () => {
      ledgersService.getDefaultLedger.mockResolvedValue({ id: 'ledger-default' });
      transactionsService.createTransaction.mockResolvedValue({
        id: 'tx-2',
        ledgerId: 'ledger-default',
        type: 'EXPENSE',
        amount: 10,
        date: new Date(),
        source: 'AGENT',
      });

      await mcpContextStorage.run(CTX_RW, () =>
        handlers['createTransaction']({ amount: 10, type: 'expense' }),
      );

      expect(categoriesService.matchCategoryByKeyword).not.toHaveBeenCalled();
      const dto = transactionsService.createTransaction.mock.calls[0][1];
      expect(dto.categoryId).toBeNull();
    });
  });

  // ============ 焦点 4：getTransactions ============
  describe('getTransactions', () => {
    it('familyId 来自 ctx，过滤条件（type/date 范围）构造正确', async () => {
      ledgersService.getDefaultLedger.mockResolvedValue({ id: 'ledger-default' });
      transactionsService.getTransactions.mockResolvedValue({
        total: 2,
        page: 2,
        pageSize: 10,
        totalPages: 1,
        items: [
          { id: 't1', type: 'EXPENSE', amount: 30, date: new Date(), source: 'MANUAL' },
          { id: 't2', type: 'EXPENSE', amount: 40, date: new Date(), source: 'MANUAL' },
        ],
      });

      const args = {
        type: 'expense',
        dateFrom: '2025-01-01',
        dateTo: '2025-12-31',
        limit: 10,
        page: 2,
      };

      const result: any = await mcpContextStorage.run(CTX_RO, () =>
        handlers['getTransactions'](args),
      );

      expect(ledgersService.getDefaultLedger).toHaveBeenCalledWith('fam-1');
      expect(transactionsService.getTransactions).toHaveBeenCalledTimes(1);

      const [uid, query] = transactionsService.getTransactions.mock.calls[0];
      expect(uid).toBe('u1');
      expect(query.ledgerId).toBe('ledger-default'); // 来自 ctx 默认账本，非客户端
      expect(query.type).toBe('expense');
      expect(query.dateFrom).toBe('2025-01-01');
      expect(query.dateTo).toBe('2025-12-31');
      expect(query.page).toBe(2);
      expect(query.pageSize).toBe(10);
      expect(query.sortBy).toBe('date');
      expect(query.sortOrder).toBe('desc');
      // 不应出现任何客户端可注入的 familyId 字段
      expect(query).not.toHaveProperty('familyId');

      const payload = JSON.parse(result.content[0].text);
      expect(payload.total).toBe(2);
      expect(payload.items).toHaveLength(2);
    });
  });

  // ============ 焦点 5：getSummary（去 LLM） ============
  describe('getSummary', () => {
    it('调用 aggregateSummary(familyId, start, end) 且返回纯结构化数据（无 LLM 文案）', async () => {
      aiReportService.aggregateSummary.mockResolvedValue({
        totalIncome: 1000,
        totalExpense: 500,
        balance: 500,
        categoryBreakdown: [],
        anomalies: [],
        period: { start: '2025-01-01T00:00:00.000Z', end: '2025-12-31T00:00:00.000Z' },
      });

      const args = { startDate: '2025-01-01', endDate: '2025-12-31' };

      const result: any = await mcpContextStorage.run(CTX_RO, () =>
        handlers['getSummary'](args),
      );

      expect(aiReportService.aggregateSummary).toHaveBeenCalledTimes(1);
      const [familyId, start, end] = aiReportService.aggregateSummary.mock.calls[0];
      expect(familyId).toBe('fam-1'); // familyId 来自 ctx
      expect(start).toBeInstanceOf(Date);
      expect(end).toBeInstanceOf(Date);
      expect((start as Date).toISOString()).toBe('2025-01-01T00:00:00.000Z');
      expect((end as Date).toISOString()).toBe('2025-12-31T00:00:00.000Z');

      const payload = JSON.parse(result.content[0].text);
      expect(payload.totalIncome).toBe(1000);
      expect(payload.balance).toBe(500);
      // 彻底无 LLM：不应有 advice / conclusion / 自然语言文案字段
      expect(payload).not.toHaveProperty('advice');
      expect(payload).not.toHaveProperty('conclusion');
      expect(payload).not.toHaveProperty('llmResponse');
    });
  });
});

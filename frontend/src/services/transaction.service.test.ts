import { describe, it, expect, vi, beforeEach } from 'vitest';
import { quickRecord } from '@/services/transaction.service';
import { TransactionType, TransactionSource, type QuickRecordRequest } from '@/types/transaction';
import type { QuickRecordResult } from '@/types/api';

/**
 * 单元测试：transaction.service（quickRecord 路径修复，Bug 404）
 *
 * 后端实际路由（全局前缀 api）：
 *   POST /api/transactions/quick   (@Post('quick'))
 *
 * 本次回归目标：确认 quickRecord 真正 POST 到 '/transactions/quick'，
 * 而不是旧路径 '/transactions/quick-record'（nginx 曾报 404：can not POST /api/transactions/quick-record）。
 *
 * 这里按 ledger.service.test.ts 的写法 mock 掉 '@/services/api' 的 get/post/put/del，
 * 断言：
 *   - quickRecord 真实请求 URL 为 '/transactions/quick'（不含 quick-record）
 *   - 请求体为 { input, ledgerId, accountId }
 *   - 返回值被解析为 QuickRecordResult 类型（含 transaction / confidence / undoToken）
 */

const h = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  get: (...args: unknown[]) => h.get(...args),
  post: (...args: unknown[]) => h.post(...args),
  put: (...args: unknown[]) => h.put(...args),
  del: (...args: unknown[]) => h.del(...args),
}));

// 一个符合 QuickRecordResult 结构的返回结果（作为 mock 的 resolve 值）
const mockResult: QuickRecordResult = {
  transaction: {
    id: 'tx-1',
    ledgerId: 'L1',
    userId: 'u1',
    categoryId: null,
    accountId: 'A1',
    type: TransactionType.EXPENSE,
    amount: 28,
    date: '2024-01-01',
    merchant: null,
    note: null,
    source: TransactionSource.QUICK_RECORD,
    importRecordId: null,
    aiConfidence: 0.9,
    aiCorrected: false,
    isLargeExpense: false,
    createdAt: '',
    updatedAt: '',
    currency: 'CNY',
    metadata: null,
    tags: [],
  },
  confidence: 0.9,
  undoToken: 'undo-1',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('transaction.service - quickRecord 路径修复 (Bug 404)', () => {
  it('quickRecord 请求 POST /transactions/quick（不是 /transactions/quick-record），且 body 为 { input, ledgerId, accountId }', async () => {
    h.post.mockResolvedValue(mockResult);

    const data: QuickRecordRequest = { input: '午饭28', ledgerId: 'L1', accountId: 'A1' };
    await quickRecord(data);

    expect(h.post).toHaveBeenCalledTimes(1);
    const [url, body] = h.post.mock.calls[0] as [string, Record<string, unknown>];

    // 关键断言：路径已对齐后端 @Post('quick')
    expect(url).toBe('/transactions/quick');
    // 反向断言：绝不能是导致 404 的旧路径
    expect(url).not.toBe('/transactions/quick-record');
    expect(url).not.toContain('quick-record');

    // 请求体结构正确
    expect(body).toEqual({ input: '午饭28', ledgerId: 'L1', accountId: 'A1' });
  });

  it('quickRecord 返回值被解析为 QuickRecordResult 类型', async () => {
    h.post.mockResolvedValue(mockResult);

    const data: QuickRecordRequest = { input: '午饭28', ledgerId: 'L1', accountId: 'A1' };
    // 此处类型标注会触发编译期检查：quickRecord 的返回必须是可赋值给 QuickRecordResult 的
    const result: QuickRecordResult = await quickRecord(data);

    expect(result).toBeDefined();
    expect(result.transaction.id).toBe('tx-1');
    expect(result.confidence).toBe(0.9);
    expect(result.undoToken).toBe('undo-1');
    expect(result).toEqual(mockResult);
  });
});

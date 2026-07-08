import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLedgers, createLedger } from '@/services/ledger.service';
import { LedgerType, type Ledger } from '@/types/family';

/**
 * 单元测试：ledger.service（Bug A 修复）
 *
 * 后端实际路由（全局前缀 api）：
 *   GET  /api/ledgers?familyId=xxx
 *   POST /api/ledgers  body: { familyId, name, type? }
 *
 * 这里 mock 掉 '@/services/api' 的 get/post，断言：
 *   - getLedgers 真实请求 URL 为 '/ledgers' 且 query(params) 带 familyId
 *   - createLedger 真实 POST 到 '/ledgers' 且 body 含 { familyId, name, type }
 */

const h = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  get: (...args: unknown[]) => h.get(...args),
  post: (...args: unknown[]) => h.post(...args),
}));

const familyId = 'fam-1';
const mockLedgers: Ledger[] = [
  { id: 'l1', familyId, ownerId: null, type: LedgerType.SHARED, name: '家庭账本', createdAt: '' },
  { id: 'l2', familyId, ownerId: null, type: LedgerType.PERSONAL, name: '个人账本', createdAt: '' },
];
const createdLedger: Ledger = {
  id: 'l-new',
  familyId,
  ownerId: null,
  type: LedgerType.SHARED,
  name: '我的账本',
  createdAt: '',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ledger.service - 修复后的请求路径 (Bug A)', () => {
  it('getLedgers 请求 GET /ledgers 且 query 带 familyId', async () => {
    h.get.mockResolvedValue(mockLedgers);

    const result = await getLedgers(familyId);

    expect(h.get).toHaveBeenCalledTimes(1);
    const [url, config] = h.get.mock.calls[0] as [string, { params?: Record<string, unknown> }];
    expect(url).toBe('/ledgers');
    expect(config?.params).toBeDefined();
    expect(config?.params?.familyId).toBe(familyId);
    expect(result).toEqual(mockLedgers);
  });

  it('createLedger 请求 POST /ledgers 且 body 含 { familyId, name, type }', async () => {
    h.post.mockResolvedValue(createdLedger);

    const result = await createLedger(familyId, '我的账本', LedgerType.SHARED);

    expect(h.post).toHaveBeenCalledTimes(1);
    const [url, body] = h.post.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe('/ledgers');
    expect(body).toEqual({ familyId, name: '我的账本', type: LedgerType.SHARED });
    expect(result).toEqual(createdLedger);
  });

  it('createLedger 默认 type 为 shared（不传第三参时）', async () => {
    h.post.mockResolvedValue(createdLedger);

    await createLedger(familyId, '我的账本');

    const [, body] = h.post.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.type).toBe(LedgerType.SHARED);
  });
});

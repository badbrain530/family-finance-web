import { ApiKeyAuthMiddleware } from '../src/modules/apikey/apikey.guard';
import { mcpContextStorage } from '../src/modules/mcp/mcp.context';

/**
 * ApiKeyAuthMiddleware 单元测试（P0 焦点 2：越权防护）
 *
 * 不连真实库：ApiKeyService 用替身注入。
 * 重点验证：
 *   1) 有效 Key -> 注入 McpContext（familyId 来自 Key 而非客户端），next 被调用；
 *   2) 无效 / 吊销 Key -> 401，next 不被调用；
 *   3) 客户端伪造 familyId 入参被忽略（上下文 familyId 始终取自 Key）。
 */

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as any;
}

describe('ApiKeyAuthMiddleware', () => {
  let middleware: ApiKeyAuthMiddleware;
  let apiKeyService: Record<string, any>;

  const VALID_CTX = {
    apiKeyId: 'k1',
    userId: 'u1',
    familyId: 'fam-from-key',
    scope: 'READWRITE' as const,
  };

  beforeEach(() => {
    apiKeyService = {
      validateKey: jest.fn(),
      markUsed: jest.fn().mockResolvedValue(undefined),
    };
    middleware = new ApiKeyAuthMiddleware(apiKeyService as any);
  });

  afterEach(() => jest.clearAllMocks());

  it('有效 Key：注入 McpContext 且 familyId 来自 Key（非客户端伪造）', async () => {
    apiKeyService.validateKey.mockResolvedValue(VALID_CTX);

    const req: any = {
      headers: { 'x-api-key': 'ak_live_valid00000000000000000000' },
      body: { familyId: 'evil-family' }, // 客户端伪造
    };
    const res = makeRes();
    let capturedStore: any = null;
    const next = jest.fn(() => {
      capturedStore = mcpContextStorage.getStore();
    });

    await middleware.use(req, res, next);

    // 校验 Key 被调用
    expect(apiKeyService.validateKey).toHaveBeenCalledWith('ak_live_valid00000000000000000000');
    // 标记最近使用
    expect(apiKeyService.markUsed).toHaveBeenCalledWith('k1');
    // 继续后续中间件
    expect(next).toHaveBeenCalledTimes(1);
    // 注入的上下文来自 Key，而非客户端伪造的 familyId
    expect(capturedStore).not.toBeUndefined();
    expect(capturedStore.familyId).toBe('fam-from-key');
    expect(capturedStore.familyId).not.toBe('evil-family');
    expect(capturedStore.userId).toBe('u1');
    expect(capturedStore.scope).toBe('READWRITE');
    // 未返回 401
    expect(res.status).not.toHaveBeenCalled();
  });

  it('无效 / 吊销 Key：返回 401 且不调用 next', async () => {
    apiKeyService.validateKey.mockResolvedValue(null); // 无效或已吊销

    const req: any = { headers: { 'x-api-key': 'ak_live_bad0000000000000000000000' } };
    const res = makeRes();
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('缺少 X-API-Key 请求头：返回 401 且不调用 next', async () => {
    const req: any = { headers: {} };
    const res = makeRes();
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(apiKeyService.validateKey).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

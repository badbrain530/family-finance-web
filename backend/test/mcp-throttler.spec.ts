import {
  InMemoryRateLimitStorage,
  McpThrottlerMiddleware,
} from '../src/modules/mcp/mcp.throttler.middleware';
import { mcpContextStorage, McpContext } from '../src/modules/mcp/mcp.context';

/**
 * MCP 限流单元测试（P0 焦点 6）
 *
 * 不连真实库，直接测内存存储与中间件逻辑。
 * 重点验证：
 *   1) 同一 apiKeyId 连续请求超过阈值（小阈值便于测试）后返回 false（应被拒）；
 *   2) 不同 Key 互不干扰；
 *   3) 跨天 / 日阈值边界；
 *   4) McpThrottlerMiddleware：放行时 next、超限返回 429、缺上下文兜底放行。
 */

describe('MCP 限流', () => {
  describe('InMemoryRateLimitStorage', () => {
    it('超过单 Key 分钟阈值后拒绝，不同 Key 互不干扰', () => {
      const storage = new InMemoryRateLimitStorage(3, 1000); // 3 次/分
      const a = 'key-a';
      const b = 'key-b';
      expect(storage.isAllowed(a)).toBe(true);
      expect(storage.isAllowed(a)).toBe(true);
      expect(storage.isAllowed(a)).toBe(true);
      expect(storage.isAllowed(a)).toBe(false); // 第 4 次拒绝
      // 不同 Key 不受影响
      expect(storage.isAllowed(b)).toBe(true);
    });

    it('新 Key 初始放行', () => {
      const storage = new InMemoryRateLimitStorage(2, 1000);
      expect(storage.isAllowed('new-key')).toBe(true);
    });

    it('超过日阈值后拒绝', () => {
      const storage = new InMemoryRateLimitStorage(1000, 2);
      const k = 'day-key';
      expect(storage.isAllowed(k)).toBe(true);
      expect(storage.isAllowed(k)).toBe(true);
      expect(storage.isAllowed(k)).toBe(false);
    });
  });

  describe('McpThrottlerMiddleware', () => {
    const CTX: McpContext = {
      apiKeyId: 'k1',
      userId: 'u1',
      familyId: 'fam-1',
      scope: 'READWRITE',
    };

    function makeRes() {
      return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      } as any;
    }

    it('放行：调用 next，不返回 429', async () => {
      const storage = { isAllowed: jest.fn().mockReturnValue(true) };
      const mw = new McpThrottlerMiddleware(storage as any);
      const req: any = {};
      const res = makeRes();
      const next = jest.fn();

      await mcpContextStorage.run(CTX, () => mw.use(req, res, next));

      expect(storage.isAllowed).toHaveBeenCalledWith('k1');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('超限：返回 429 且不调用 next', async () => {
      const storage = { isAllowed: jest.fn().mockReturnValue(false) };
      const mw = new McpThrottlerMiddleware(storage as any);
      const req: any = {};
      const res = makeRes();
      const next = jest.fn();

      await mcpContextStorage.run(CTX, () => mw.use(req, res, next));

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('缺少 McpContext 时兜底放行', async () => {
      const storage = { isAllowed: jest.fn() };
      const mw = new McpThrottlerMiddleware(storage as any);
      const req: any = {};
      const res = makeRes();
      const next = jest.fn();

      // 不在 mcpContextStorage.run 内，store 为空 -> 兜底放行
      await mw.use(req, res, next);

      expect(storage.isAllowed).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });
});

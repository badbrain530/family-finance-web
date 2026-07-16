import { Injectable, Logger } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from './apikey.service';
import { mcpContextStorage } from '../mcp/mcp.context';

/**
 * MCP 鉴权中间件（X-API-Key → McpContext）
 *
 * 职责：
 * 1. 从请求头 X-API-Key 取明文 Key；
 * 2. 查库 + 恒定时间比对（ApiKeyService.validateKey）；无效 / 已吊销 → 401；
 * 3. 校验通过后在 AsyncLocalStorage 中注入 McpContext，并继续后续中间件 / MCP Handler。
 *
 * 挂载位置：原生 Express 中间件 /mcp（见 McpModule），绕开网页 JWT 守卫与全局
 * ValidationPipe，精确得到 family-finance.cloud/mcp 路径。
 */
@Injectable()
export class ApiKeyAuthMiddleware {
  private readonly logger = new Logger(ApiKeyAuthMiddleware.name);

  constructor(private readonly apiKeyService: ApiKeyService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawHeader = req.headers['x-api-key'];
      const plainKey = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

      if (!plainKey) {
        this.sendUnauthorized(res, '缺少 X-API-Key 请求头');
        return;
      }

      const ctx = await this.apiKeyService.validateKey(plainKey);
      if (!ctx) {
        this.sendUnauthorized(res, '无效的 API Key 或密钥已被吊销');
        return;
      }

      // 异步标记最近使用（不阻塞主流程）
      void this.apiKeyService.markUsed(ctx.apiKeyId);

      // 在 AsyncLocalStorage 上下文中继续处理，工具内可 getMcpContext() 取 familyId 等
      mcpContextStorage.run(ctx, () => next());
    } catch (err) {
      this.logger.error(`MCP 鉴权异常: ${err instanceof Error ? err.message : String(err)}`);
      this.sendUnauthorized(res, '鉴权失败');
    }
  }

  private sendUnauthorized(res: Response, message: string): void {
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message,
      },
      id: null,
    });
  }
}

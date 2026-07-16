import { Injectable, Logger, Inject } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { getMcpContext } from './mcp.context';

/** 限流存储实现注入令牌（接口无法被 Nest 直接注入，需用令牌绑定具体实现） */
export const RATE_LIMIT_STORAGE = 'RATE_LIMIT_STORAGE';

/**
 * 限流存储接口（按 apiKeyId 维度）
 * 预留多实例扩展点：单实例用内存实现；多副本时替换为 Redis 实现即可。
 */
export interface RateLimitStorage {
  /** 返回 true 表示放行；false 表示超过阈值，应返回 429 */
  isAllowed(apiKeyId: string): boolean;
}

interface Bucket {
  minuteCount: number;
  minuteResetAt: number;
  dayCount: number;
  dayResetAt: number;
}

const WINDOW_MINUTE_MS = 60_000;
const WINDOW_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 单实例内存限流（P0 最小阈值）
 * 阈值：单 Key 60 次/分、1000 次/天。
 */
export class InMemoryRateLimitStorage implements RateLimitStorage {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly maxPerMinute = 60,
    private readonly maxPerDay = 1000,
  ) {}

  isAllowed(apiKeyId: string): boolean {
    const now = Date.now();
    let bucket = this.buckets.get(apiKeyId);

    if (!bucket || now >= bucket.dayResetAt) {
      // 新 Key 或跨天：重置
      bucket = {
        minuteCount: 0,
        minuteResetAt: now + WINDOW_MINUTE_MS,
        dayCount: 0,
        dayResetAt: now + WINDOW_DAY_MS,
      };
    } else if (now >= bucket.minuteResetAt) {
      // 跨分钟窗口：仅重置分钟计数
      bucket.minuteCount = 0;
      bucket.minuteResetAt = now + WINDOW_MINUTE_MS;
    }

    if (bucket.dayCount >= this.maxPerDay || bucket.minuteCount >= this.maxPerMinute) {
      // 命中阈值：保留桶（不累加），拒绝
      this.buckets.set(apiKeyId, bucket);
      return false;
    }

    bucket.minuteCount += 1;
    bucket.dayCount += 1;
    this.buckets.set(apiKeyId, bucket);
    return true;
  }
}

/**
 * MCP 限流中间件（按 apiKeyId）
 * 随 ApiKeyAuthMiddleware 之后执行，此时 McpContext 已在 AsyncLocalStorage 中可用。
 * 超阈值返回 429（JSON-RPC 错误形态），正常放行。
 */
@Injectable()
export class McpThrottlerMiddleware {
  private readonly logger = new Logger(McpThrottlerMiddleware.name);

  constructor(@Inject(RATE_LIMIT_STORAGE) private readonly storage: RateLimitStorage) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const ctx = getMcpContext();
    // 理论上经 ApiKeyAuthMiddleware 后 ctx 必存在；兜底放行交由后续处理
    if (!ctx) {
      next();
      return;
    }

    if (!this.storage.isAllowed(ctx.apiKeyId)) {
      this.logger.warn(`MCP 限流触发: apiKeyId=${ctx.apiKeyId}`);
      res.status(429).json({
        jsonrpc: '2.0',
        error: {
          code: -32002,
          message: 'API Key 调用频率超限（限制 60 次/分、1000 次/天），请稍后重试',
        },
        id: null,
      });
      return;
    }

    next();
  }
}

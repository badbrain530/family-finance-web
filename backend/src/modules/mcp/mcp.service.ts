import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Request, Response, NextFunction } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { ApiKeyAuthMiddleware } from '../apikey/apikey.guard';
import {
  McpThrottlerMiddleware,
  InMemoryRateLimitStorage,
  RATE_LIMIT_STORAGE,
  RateLimitStorage,
} from './mcp.throttler.middleware';
import { TransactionsService } from '../transactions/transactions.service';
import { LedgersService } from '../ledgers/ledgers.service';
import { CategoriesService } from '../categories/categories.service';
import { AiReportService } from '../ai/ai-report.service';
import { registerCreateTransactionTool } from './tools/create-transaction.tool';
import { registerGetTransactionsTool } from './tools/get-transactions.tool';
import { registerGetSummaryTool } from './tools/get-summary.tool';
import type { McpToolDeps } from './mcp.types';

/**
 * MCP 服务（T4 基础框架）
 *
 * 职责：
 * - 在 onModuleInit 中以原生 Express 中间件挂载 /mcp 端点，绕开网页 JWT 守卫与
 *   全局 ValidationPipe / 异常过滤器（MCP 走独立 streamable-http 协议）；
 * - 请求链路：ApiKeyAuthMiddleware（X-API-Key → McpContext）→ McpThrottlerMiddleware
 *   （按 Key 限流）→ transport.handleRequest；
 * - 采用 streamable-http 无会话（stateless）模式：sessionIdGenerator=undefined，
 *   enableJsonResponse=true（复用既有 HTTPS/SSL，返回纯 JSON）。
 *
 * 关键点（SDK 源码约束）：stateless 模式下每个请求必须使用「全新」的
 * StreamableHTTPServerTransport，复用同一实例会因消息 ID 冲突而报错。
 * 因此每次请求都构建一个新的 McpServer + Transport。
 */
@Injectable()
export class McpService implements OnModuleInit {
  private readonly logger = new Logger(McpService.name);

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly apiKeyAuthMiddleware: ApiKeyAuthMiddleware,
    private readonly mcpThrottlerMiddleware: McpThrottlerMiddleware,
    private readonly transactionsService: TransactionsService,
    private readonly ledgersService: LedgersService,
    private readonly categoriesService: CategoriesService,
    private readonly aiReportService: AiReportService,
  ) {}

  onModuleInit(): void {
    // 取得底层 Express 实例（Nest 默认 http 适配器为 Express）
    const expressApp = this.httpAdapterHost.httpAdapter.getInstance() as unknown as {
      use: (handler: (req: Request, res: Response, next: NextFunction) => void) => void;
    };

    // 组合中间件：鉴权 → 限流 → MCP 处理（均在 McpContext 的 AsyncLocalStorage 内执行）
    const mcpHandler = (req: Request, res: Response): void => {
      this.apiKeyAuthMiddleware.use(req, res, () => {
        this.mcpThrottlerMiddleware.use(req, res, () => {
          void this.handleMcp(req, res);
        });
      });
    };

    // 根级 use + 路径守卫：仅拦截 /mcp，其余请求放行给 Nest 路由。
    // 不使用 app.use('/mcp', ...) 是为了避免 Express 剥除 req.url 前缀，
    // 保证 transport 看到的 req.url 仍为 '/mcp'。
    expressApp.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path === '/mcp') {
        mcpHandler(req, res);
      } else {
        next();
      }
    });

    this.logger.log('MCP Streamable HTTP 端点已挂载于 /mcp（stateless 模式）');
  }

  /**
   * 处理单个 MCP 请求：
   * 为每个请求创建全新的 McpServer + Transport（stateless 必需），
   * 注册三个核心工具，connect 后交由 transport 解析并响应。
   */
  private async handleMcp(req: Request, res: Response): Promise<void> {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    const server = this.buildServer();
    await server.connect(transport);

    // 连接关闭后释放资源，避免内存泄漏
    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    await transport.handleRequest(req, res, (req as unknown as { body?: unknown }).body);
  }

  /**
   * 构建一个注册好全部工具的 McpServer 实例。
   * 每次请求都新建，故不存在工具定义共享状态问题。
   */
  private buildServer(): McpServer {
    const server = new McpServer({
      name: 'family-finance-mcp',
      version: '1.0.0',
    });

    const deps: McpToolDeps = {
      transactionsService: this.transactionsService,
      ledgersService: this.ledgersService,
      categoriesService: this.categoriesService,
      aiReportService: this.aiReportService,
    };

    registerCreateTransactionTool(server, deps);
    registerGetTransactionsTool(server, deps);
    registerGetSummaryTool(server, deps);

    return server;
  }
}

/** 供 McpModule 使用的限流存储实现工厂 */
export const rateLimitStorageProvider = {
  provide: RATE_LIMIT_STORAGE,
  useFactory: (): RateLimitStorage => new InMemoryRateLimitStorage(60, 1000),
};

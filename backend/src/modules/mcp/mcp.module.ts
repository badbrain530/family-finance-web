import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ApiKeyModule } from '../apikey/apikey.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { LedgersModule } from '../ledgers/ledgers.module';
import { CategoriesModule } from '../categories/categories.module';
import { AiModule } from '../ai/ai.module';

import { McpService, rateLimitStorageProvider } from './mcp.service';
import { McpThrottlerMiddleware } from './mcp.throttler.middleware';
import { ApiKeyAuthMiddleware } from '../apikey/apikey.guard';

/**
 * MCP 模块（T4 基础框架）
 *
 * 聚合 MCP 运行所需的所有依赖：
 * - ApiKeyModule（提供 ApiKeyService 供鉴权中间件校验 Key）；
 * - TransactionsModule / LedgersModule / CategoriesModule / AiModule（供三个核心工具复用）；
 * - 原生 Express 中间件（ApiKeyAuthMiddleware、McpThrottlerMiddleware）于 McpService.onModuleInit 挂载。
 */
@Module({
  imports: [
    PrismaModule,
    ApiKeyModule,
    TransactionsModule,
    LedgersModule,
    CategoriesModule,
    AiModule,
  ],
  providers: [
    ApiKeyAuthMiddleware,
    McpThrottlerMiddleware,
    McpService,
    rateLimitStorageProvider,
  ],
  exports: [McpService],
})
export class McpModule {}

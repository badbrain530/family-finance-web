/**
 * AI 服务模块
 * 仅保留「聚合统计 + 异常检测」纯数据能力（P0-05 去 LLM 段）。
 * QwenProvider 已移除：后端不再调用任何大模型，结论生成职责转移到用户侧 QClaw。
 *
 * 依赖：
 * - PrismaModule（数据库）
 * - CategoriesModule（分类服务）
 * - EventEmitterModule（全局已注册）
 */

import { Module } from '@nestjs/common';
import { AiReportService } from './ai-report.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [PrismaModule, CategoriesModule],
  providers: [AiReportService],
  exports: [AiReportService],
})
export class AiModule {}

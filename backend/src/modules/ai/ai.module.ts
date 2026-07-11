/**
 * AI服务模块
 * 包含：通义千问LLM Provider、AI分类服务、AI月报生成服务
 *
 * 依赖：
 * - PrismaModule（数据库）
 * - CategoriesModule（分类服务，用于规则匹配）
 * - EventEmitterModule（已在全局注册）
 */

import { Module } from '@nestjs/common';
import { QwenProvider } from './providers/qwen.provider';
import { AiReportService } from './ai-report.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [PrismaModule, CategoriesModule],
  providers: [
    QwenProvider,
    AiReportService,
    // 导出LLM Provider接口，使用Symbol token以便后续支持多Provider切换
    {
      provide: 'ILLMProvider',
      useExisting: QwenProvider,
    },
  ],
  exports: [
    QwenProvider,
    AiReportService,
    {
      provide: 'ILLMProvider',
      useExisting: QwenProvider,
    },
  ],
})
export class AiModule {}

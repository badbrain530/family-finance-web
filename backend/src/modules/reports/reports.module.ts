import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { FamiliesModule } from '../families/families.module';
import { AiModule } from '../ai/ai.module';

/**
 * 报告模块
 * 依赖 FamiliesModule（提供 FamiliesService.validateFamilyMember 做成员校验）
 * 与 AiModule（提供 AiReportService 做真实月报生成）。
 */
@Module({
  imports: [FamiliesModule, AiModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}

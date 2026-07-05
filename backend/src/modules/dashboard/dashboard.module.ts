import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { FamiliesModule } from '../families/families.module';

/**
 * 仪表盘模块
 * 功能：聚合家庭财务数据，一次API调用返回所有仪表盘所需数据
 *
 * 聚合内容：
 * 1. 本月KPI（收入/支出/结余/环比）
 * 2. 预算执行概览
 * 3. 最近交易5条
 * 4. 收支趋势（6个月）
 * 5. 分类支出占比
 * 6. 心愿目标进度
 * 7. 成员贡献
 *
 * 依赖：
 * - PrismaModule: 数据库操作
 * - FamiliesModule: 家庭成员权限验证
 */
@Module({
  imports: [PrismaModule, FamiliesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}

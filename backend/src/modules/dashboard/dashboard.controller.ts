import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

/**
 * 仪表盘控制器
 * 提供仪表盘聚合数据查询接口
 *
 * 路由前缀：/api/dashboard
 * 所有接口需要JWT认证
 */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * 获取仪表盘聚合数据
   * GET /api/dashboard?familyId=xxx&year=2026&month=7
   *
   * 一次调用返回所有仪表盘所需数据：
   * - 本月KPI（收入/支出/结余/环比）
   * - 预算执行概览
   * - 最近交易5条
   * - 收支趋势（6个月）
   * - 分类支出占比
   * - 心愿目标进度
   * - 成员贡献
   */
  @Get()
  async getDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query('familyId') familyId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.dashboardService.getDashboard(
      user.userId,
      familyId,
      year ? parseInt(year, 10) : undefined,
      month ? parseInt(month, 10) : undefined,
    );
  }
}

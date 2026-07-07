import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { GenerateMonthlyReportDto } from './dto/generate-monthly-report.dto';

/**
 * 报告控制器
 * 提供月度财务洞察报告的读取与生成接口。
 *
 * 路由前缀：/api/reports（全局前缀 api）
 * 所有接口需要 JWT 认证（全局 JwtAuthGuard）。
 * 所有接口均先校验「当前用户是否为该家庭成员」，防止越权读取他人家庭报表。
 */
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * 获取指定年月的月报
   * GET /api/reports/monthly?familyId=xxx&year=2026&month=7
   *
   * 若该月无月报，服务层抛出 NotFoundException（code: 3004），
   * 由全局异常过滤器转为统一错误响应，前端据此展示「生成月报」空状态。
   */
  @Get('monthly')
  getMonthlyReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('familyId') familyId: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    // 缺省时使用「当前年月」，避免参数为 undefined；前端始终显式传值
    const now = new Date();
    const y = year ? parseInt(year, 10) : now.getFullYear();
    const m = month ? parseInt(month, 10) : now.getMonth() + 1;
    return this.reportsService.getMonthlyReport(user.userId, familyId, y, m);
  }

  /**
   * 生成指定年月的月报
   * POST /api/reports/monthly/generate
   * body: { familyId: string, year: number, month: number }
   *
   * 复用已有的 AiReportService.generateMonthlyReport（真实聚合家庭当月交易 + AI 建议）。
   */
  @Post('monthly/generate')
  generateMonthlyReport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateMonthlyReportDto,
  ) {
    return this.reportsService.generateMonthlyReport(
      user.userId,
      dto.familyId,
      dto.year,
      dto.month,
    );
  }
}

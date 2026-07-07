import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FamiliesService } from '../families/families.service';
import { AiReportService } from '../ai/ai-report.service';

/**
 * 报告服务
 * 负责月度财务洞察报告的「读取」与「生成」编排。
 *
 * - 读取：校验家庭成员身份后，从 monthlyReport 表按唯一键查询；
 *   查不到则抛出 3004，让前端展示「生成月报」空状态。
 * - 生成：校验家庭成员身份后，委托 AiReportService 真实聚合家庭当月交易并产出月报。
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly familiesService: FamiliesService,
    private readonly aiReportService: AiReportService,
  ) {}

  /**
   * 获取指定年月的月报
   *
   * @param userId 当前登录用户ID（用于家庭成员校验）
   * @param familyId 家庭ID
   * @param year 年份
   * @param month 月份（1-12）
   * @returns 月报记录（结构与前端 MonthlyReport 类型一致）
   * @throws NotFoundException(code:3004) 当月无月报时
   */
  async getMonthlyReport(
    userId: string,
    familyId: string,
    year: number,
    month: number,
  ) {
    // 安全：先校验家庭成员身份，防止越权读取他人家庭报表
    await this.familiesService.validateFamilyMember(familyId, userId);

    const report = await this.prisma.monthlyReport.findUnique({
      where: { familyId_year_month: { familyId, year, month } },
    });

    if (!report) {
      throw new NotFoundException({
        code: 3004,
        message: '本月暂无月报，请点击生成',
      });
    }

    // 直接返回存储结构（categoryBreakdown/anomalies/advice 以 JSON 存储，读取即返回），无需额外映射
    return report;
  }

  /**
   * 生成指定年月的月报
   *
   * @param userId 当前登录用户ID（用于家庭成员校验）
   * @param familyId 家庭ID
   * @param year 年份
   * @param month 月份（1-12）
   * @returns 生成的月报记录
   */
  async generateMonthlyReport(
    userId: string,
    familyId: string,
    year: number,
    month: number,
  ) {
    // 安全：先校验家庭成员身份
    await this.familiesService.validateFamilyMember(familyId, userId);

    // 复用已有的真实月报生成逻辑（聚合交易 + AI 建议 + upsert）
    return this.aiReportService.generateMonthlyReport(familyId, year, month);
  }
}

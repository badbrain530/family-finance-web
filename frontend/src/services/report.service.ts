import { get, post } from './api';
import type { MonthlyReport } from '@/types/report';

/**
 * 月度报告 API 服务
 *
 * 契约对齐（根因修复）：
 * 后端 backend/src/modules/reports/reports.controller.ts 暴露：
 *   GET  /api/reports/monthly?familyId=&year=&month=
 *   POST /api/reports/monthly/generate  body: { familyId, year, month }
 * 查询参数写法对齐 dashboard.service.ts 的 getDashboardData(familyId, year, month)。
 */

/** 获取指定年月的月报；无数据（后端 3004）时前端展示空状态 */
export function getMonthlyReport(
  familyId: string,
  year: number,
  month: number,
): Promise<MonthlyReport> {
  return get<MonthlyReport>('/reports/monthly', { familyId, year, month });
}

/** 生成指定年月的月报 */
export function generateMonthlyReport(
  familyId: string,
  year: number,
  month: number,
): Promise<MonthlyReport> {
  return post<MonthlyReport>('/reports/monthly/generate', { familyId, year, month });
}

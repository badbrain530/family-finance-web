import { get } from './api';
import type { DashboardData } from '@/types/report';

/**
 * 仪表盘聚合数据API服务
 *
 * ⚠️ 契约对齐（根因修复）：
 * 后端 backend/src/modules/dashboard/dashboard.controller.ts 暴露的是
 *   GET /api/dashboard?familyId=&year=&month=
 * （@Controller('dashboard') + @Get() + @Query('familyId'|'year'|'month'））。
 * 因此 familyId 必须以**查询参数**传递，绝不能写成 /dashboard/:familyId 路径参数，
 * 否则请求落到不存在的路由 → 404/403 → 白屏。
 * 写法对齐 category.service.ts 的 getCategories(familyId) 风格。
 */

/** 获取仪表盘聚合数据 */
export function getDashboardData(familyId: string, year?: number, month?: number): Promise<DashboardData> {
  return get<DashboardData>('/dashboard', { familyId, year, month });
}

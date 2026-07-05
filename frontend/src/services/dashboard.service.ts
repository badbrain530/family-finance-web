import { get } from './api';
import type { DashboardData } from '@/types/report';

/**
 * 仪表盘聚合数据API服务
 */

/** 获取仪表盘聚合数据 */
export function getDashboardData(familyId: string, year?: number, month?: number): Promise<DashboardData> {
  return get<DashboardData>(`/dashboard/${familyId}`, { year, month });
}

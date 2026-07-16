import { get, post, put, del } from './api';
import type { Bond, BondSchedule, CouponFrequency } from '@/types/transaction';

/**
 * 债券服务（仅 HELD 持有方）
 * 严格对齐后端 BondsController / CreateBondDto / UpdateBondDto / GenerateBondDto
 *
 * 路由映射：
 *   GET    /api/bonds?familyId=              → listBonds（含完整票息计划 schedules）
 *   POST   /api/bonds                        → createBond（同时计算完整票息计划）
 *   GET    /api/bonds/:id                    → getBond（含 schedules）
 *   PUT    /api/bonds/:id                    → updateBond
 *   DELETE /api/bonds/:id                    → deleteBond
 *   POST   /api/bonds/:id/generate           → generatePayments（为到期 pending 计划生成票息 INCOME）
 */

/** 创建债券请求（对齐 CreateBondDto） */
export interface CreateBondRequest {
  /** 账本ID（必填） */
  ledgerId: string;
  /** 关联账户（票息入账账户，可空） */
  accountId?: string | null;
  /** 债券名称（必填） */
  name: string;
  /** 面值（元，最多2位小数，>0） */
  faceValue: number;
  /** 年利率（如 4.2 表示 4.2%） */
  annualRate: number;
  /** 期限（月数，>=1） */
  termMonths: number;
  /** 票息频率 */
  couponFrequency: CouponFrequency;
  /** 首次起息日（YYYY-MM-DD） */
  startDate: string;
  /** 分类ID（可空） */
  categoryId?: string | null;
}

/** 更新债券请求（全部可选，对齐 UpdateBondDto） */
export type UpdateBondRequest = Partial<CreateBondRequest>;

/** 生成票息交易请求（对齐 GenerateBondDto） */
export interface GenerateBondRequest {
  /** 生成到该日期（含）之前的到期 pending 计划（YYYY-MM-DD） */
  upto?: string;
}

/** 生成结果 */
export interface GenerateBondResult {
  /** 本次生成的票息交易条数 */
  generated: number;
}

/** 列表 GET /api/bonds?familyId= （含完整票息计划 schedules） */
export function listBonds(familyId: string): Promise<Bond[]> {
  return get<Bond[]>('/bonds', { familyId });
}

/** 创建债券 POST /api/bonds */
export function createBond(data: CreateBondRequest): Promise<Bond> {
  return post<Bond>('/bonds', data);
}

/** 债券详情 GET /api/bonds/:id （含 schedules） */
export function getBond(bondId: string): Promise<Bond> {
  return get<Bond>(`/bonds/${bondId}`);
}

/** 更新债券 PUT /api/bonds/:id */
export function updateBond(bondId: string, data: UpdateBondRequest): Promise<Bond> {
  return put<Bond>(`/bonds/${bondId}`, data);
}

/** 为到期 pending 计划生成票息交易 POST /api/bonds/:id/generate */
export function generatePayments(bondId: string, data: GenerateBondRequest = {}): Promise<GenerateBondResult> {
  return post<GenerateBondResult>(`/bonds/${bondId}/generate`, data);
}

/** 删除债券 DELETE /api/bonds/:id（级联删除票息计划） */
export function deleteBond(bondId: string): Promise<{ success: boolean }> {
  return del(`/bonds/${bondId}`);
}

/** 债券票息计划明细类型（再导出，方便页面引用） */
export type { BondSchedule };

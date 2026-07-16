import { get, post, put, del } from './api';
import type { AmortizationItem, AmortizationSchedule, AmortizationType } from '@/types/transaction';

/**
 * 待摊/预付服务
 * 严格对齐后端 AmortizationController / CreateAmortizationDto / UpdateAmortizationDto / GenerateAmortizationDto
 *
 * 路由映射：
 *   GET    /api/amortizations?familyId=              → listItems（含完整摊销计划 schedules）
 *   POST   /api/amortizations                        → createItem（初始入账 EXPENSE + 算全表）
 *   GET    /api/amortizations/:id                    → getItem（含 schedules）
 *   PUT    /api/amortizations/:id                    → updateItem
 *   DELETE /api/amortizations/:id                    → deleteItem
 *   POST   /api/amortizations/:id/generate           → generate（为到期 pending 计划生成摊销 EXPENSE）
 */

/** 创建待摊/预付请求（对齐 CreateAmortizationDto） */
export interface CreateAmortizationRequest {
  /** 账本ID（必填） */
  ledgerId: string;
  /** 关联账户（初始入账账户，可空） */
  accountId?: string | null;
  /** 名称（如「年费」「装修」，必填） */
  name: string;
  /** 总金额（元，最多2位小数，>0） */
  totalAmount: number;
  /** 摊销期数（月，>=1） */
  periodMonths: number;
  /** 类型：PREPAID 预付 / DEFERRED 待摊 */
  type: AmortizationType;
  /** 分类ID（可空） */
  categoryId?: string | null;
  /** 开始日期（YYYY-MM-DD，初始入账日，必填） */
  startDate: string;
  /** 备注（可空） */
  note?: string;
}

/** 更新待摊/预付请求（全部可选，对齐 UpdateAmortizationDto） */
export type UpdateAmortizationRequest = Partial<CreateAmortizationRequest>;

/** 生成摊销交易请求（对齐 GenerateAmortizationDto） */
export interface GenerateAmortizationRequest {
  /** 生成到该日期（含）之前的到期 pending 计划（YYYY-MM-DD） */
  upto?: string;
}

/** 生成结果 */
export interface GenerateAmortizationResult {
  /** 本次生成的摊销交易条数 */
  generated: number;
}

/** 列表 GET /api/amortizations?familyId= （含完整摊销计划 schedules） */
export function listAmortizations(familyId: string): Promise<AmortizationItem[]> {
  return get<AmortizationItem[]>('/amortizations', { familyId });
}

/** 创建待摊/预付 POST /api/amortizations */
export function createAmortization(data: CreateAmortizationRequest): Promise<AmortizationItem> {
  return post<AmortizationItem>('/amortizations', data);
}

/** 待摊/预付详情 GET /api/amortizations/:id （含 schedules） */
export function getAmortization(itemId: string): Promise<AmortizationItem> {
  return get<AmortizationItem>(`/amortizations/${itemId}`);
}

/** 更新待摊/预付 PUT /api/amortizations/:id */
export function updateAmortization(itemId: string, data: UpdateAmortizationRequest): Promise<AmortizationItem> {
  return put<AmortizationItem>(`/amortizations/${itemId}`, data);
}

/** 为到期 pending 计划生成摊销交易 POST /api/amortizations/:id/generate */
export function generateAmortization(itemId: string, data: GenerateAmortizationRequest = {}): Promise<GenerateAmortizationResult> {
  return post<GenerateAmortizationResult>(`/amortizations/${itemId}/generate`, data);
}

/** 删除待摊/预付 DELETE /api/amortizations/:id */
export function deleteAmortization(itemId: string): Promise<{ success: boolean }> {
  return del(`/amortizations/${itemId}`);
}

/** 摊销计划明细类型（再导出，方便页面引用） */
export type { AmortizationSchedule };

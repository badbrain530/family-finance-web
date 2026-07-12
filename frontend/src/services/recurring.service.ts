import { get, post, put, del } from './api';
import type { RecurringRule, Frequency } from '@/types/transaction';

/**
 * 周期记账服务
 * 严格对齐后端 RecurringController / CreateRecurringRuleDto / UpdateRecurringRuleDto / GenerateRecurringDto
 *
 * 路由映射：
 *   GET    /api/recurring?familyId=              → listRules
 *   POST   /api/recurring                        → createRule
 *   PUT    /api/recurring/:id                    → updateRule
 *   DELETE /api/recurring/:id                    → deleteRule
 *   POST   /api/recurring/generate               → generateAll（手动补生成全部到期项）
 *   POST   /api/recurring/:id/generate           → generateNow（单规则立即生成）
 */

/** 创建周期规则请求（对齐 CreateRecurringRuleDto） */
export interface CreateRecurringRuleRequest {
  /** 账本ID（必填） */
  ledgerId: string;
  /** 分类ID（可空） */
  categoryId?: string | null;
  /** 关联账户（生成交易时带入，可空） */
  accountId?: string | null;
  /** 交易类型（仅 income/expense） */
  type: 'income' | 'expense';
  /** 金额（元，最多2位小数，>0） */
  amount: number;
  /** 商户名 */
  merchant?: string;
  /** 备注 */
  note?: string;
  /** 频率 */
  frequency: Frequency;
  /** 间隔（默认1） */
  interval?: number;
  /** WEEKLY：星期几 1-7 */
  weekday?: number;
  /** MONTHLY：几号 1-31 */
  monthDay?: number;
  /** 起始日（首次生成不早于该日，ISO 日期串） */
  startDate: string;
  /** 结束日（可选，ISO 日期串） */
  endDate?: string;
}

/** 更新周期规则请求（全可选，对齐 UpdateRecurringRuleDto） */
export type UpdateRecurringRuleRequest = Partial<CreateRecurringRuleRequest> & {
  /** 启用/暂停 */
  isActive?: boolean;
};

/** 手动补生成（全部规则）请求（对齐 GenerateRecurringDto） */
export interface GenerateRecurringRequest {
  /** 目标家庭ID（必填） */
  familyId: string;
  /** 生成到该时间（含）之前到期且未生成的项，默认 now（ISO 日期串） */
  before?: string;
}

/** 生成结果（create 与 generate 共用） */
export interface GenerateRecurringResult {
  /** 本次生成的交易条数 */
  generated: number;
  /** 命中并已生成的规则ID列表（仅 generateAll 返回） */
  rules?: string[];
}

/** 规则列表 GET /api/recurring?familyId= */
export function listRules(familyId: string): Promise<RecurringRule[]> {
  return get<RecurringRule[]>('/recurring', { familyId });
}

/** 创建规则 POST /api/recurring */
export function createRule(data: CreateRecurringRuleRequest): Promise<RecurringRule> {
  return post<RecurringRule>('/recurring', data);
}

/** 更新规则 PUT /api/recurring/:id */
export function updateRule(id: string, data: UpdateRecurringRuleRequest): Promise<RecurringRule> {
  return put<RecurringRule>(`/recurring/${id}`, data);
}

/** 删除规则 DELETE /api/recurring/:id */
export function deleteRule(id: string): Promise<{ success: boolean }> {
  return del(`/recurring/${id}`);
}

/** 启用/暂停规则（封装 updateRule 的 isActive 字段） */
export function toggleRule(id: string, isActive: boolean): Promise<RecurringRule> {
  return updateRule(id, { isActive });
}

/** 单规则立即生成到期项 POST /api/recurring/:id/generate */
export function generateNow(id: string): Promise<GenerateRecurringResult> {
  return post<GenerateRecurringResult>(`/recurring/${id}/generate`);
}

/** 手动补生成全部到期项 POST /api/recurring/generate */
export function generateAll(data: GenerateRecurringRequest): Promise<GenerateRecurringResult> {
  return post<GenerateRecurringResult>('/recurring/generate', data);
}

import { get, post, put, del } from './api';
import type { AdvanceReceivable, DebtorType } from '@/types/transaction';

/**
 * 垫付服务
 * 严格对齐后端 AdvancesController / CreateAdvanceDto / CollectAdvanceDto / UpdateAdvanceDto
 *
 * 路由映射：
 *   GET    /api/advances?familyId=&status=    → listAdvances（含 sourceTx）
 *   POST   /api/advances                        → registerAdvance（源 EXPENSE 交易 + AdvanceReceivable）
 *   GET    /api/advances/:id                    → getAdvance（含 sourceTx）
 *   PUT    /api/advances/:id                    → updateAdvance
 *   DELETE /api/advances/:id                    → deleteAdvance（仅删应收登记，源支出保留）
 *   POST   /api/advances/:id/collect           → collect（生成 INCOME 收款交易 + 更新余额状态）
 */

/** 登记垫付请求（对齐 CreateAdvanceDto） */
export interface CreateAdvanceRequest {
  /** 账本ID（源支出归属账本，必填） */
  ledgerId: string;
  /** 关联账户（源支出扣款账户，可空） */
  accountId?: string | null;
  /** 垫付人（家庭成员 user.id，必填） */
  payerId: string;
  /** 债务人姓名（必填） */
  debtorName: string;
  /** 债务人类型 */
  debtorType: DebtorType;
  /** 垫付金额（元，最多2位小数，>0） */
  amount: number;
  /** 约定归还日（可空，YYYY-MM-DD） */
  dueDate?: string;
  /** 分类ID（可空） */
  categoryId?: string | null;
  /** 备注（可空） */
  note?: string;
}

/** 更新垫付请求（全部可选，对齐 UpdateAdvanceDto） */
export interface UpdateAdvanceRequest {
  debtorName?: string;
  dueDate?: string;
  note?: string;
}

/** 收回垫付请求（对齐 CollectAdvanceDto） */
export interface CollectAdvanceRequest {
  /** 本次收回金额（元，可部分） */
  amount: number;
  /** 到账日期（YYYY-MM-DD） */
  date: string;
  /** 入账账户（默认取源垫付账户） */
  accountId?: string | null;
}

/** 收回结果 */
export interface CollectAdvanceResult {
  repaidAmount: number;
  remainingAmount: number;
  status: 'PENDING' | 'PARTIAL' | 'RECOVERED' | 'CANCELLED';
}

/** 列表 GET /api/advances?familyId=&status= （含 sourceTx） */
export function listAdvances(familyId: string, status?: string): Promise<AdvanceReceivable[]> {
  return get<AdvanceReceivable[]>('/advances', status ? { familyId, status } : { familyId });
}

/** 登记垫付 POST /api/advances */
export function registerAdvance(data: CreateAdvanceRequest): Promise<AdvanceReceivable> {
  return post<AdvanceReceivable>('/advances', data);
}

/** 垫付详情 GET /api/advances/:id （含 sourceTx） */
export function getAdvance(id: string): Promise<AdvanceReceivable> {
  return get<AdvanceReceivable>(`/advances/${id}`);
}

/** 更新垫付 PUT /api/advances/:id */
export function updateAdvance(id: string, data: UpdateAdvanceRequest): Promise<AdvanceReceivable> {
  return put<AdvanceReceivable>(`/advances/${id}`, data);
}

/** 收回垫付 POST /api/advances/:id/collect */
export function collectAdvance(id: string, data: CollectAdvanceRequest): Promise<CollectAdvanceResult> {
  return post<CollectAdvanceResult>(`/advances/${id}/collect`, data);
}

/** 删除垫付 DELETE /api/advances/:id（仅删应收登记，源支出保留） */
export function deleteAdvance(id: string): Promise<{ success: boolean }> {
  return del(`/advances/${id}`);
}

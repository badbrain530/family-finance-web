import { get, post, del } from './api';
import type { Loan, LoanSchedule, LoanMethod } from '@/types/transaction';

/**
 * 按揭贷款服务
 * 严格对齐后端 LoansController / CreateLoanDto / UpdateLoanDto / GenerateLoanDto
 *
 * 路由映射：
 *   GET    /api/loans?familyId=              → listLoans（含完整还款计划 schedules）
 *   POST   /api/loans                        → createLoan（同时计算完整还款计划）
 *   GET    /api/loans/:id                    → getSchedules（含 schedules 的贷款主体）
 *   DELETE /api/loans/:id                    → deleteLoan
 *   POST   /api/loans/:id/generate           → generatePayment（为到期 pending 计划生成还款交易）
 */

/** 创建贷款请求（对齐 CreateLoanDto） */
export interface CreateLoanRequest {
  /** 账本ID（必填） */
  ledgerId: string;
  /** 关联账户（还款扣款账户，可空） */
  accountId?: string | null;
  /** 贷款名称（如「房贷」「车贷」，必填） */
  name: string;
  /** 贷款本金（元，最多2位小数，>0） */
  principal: number;
  /** 年利率（如 4.2 表示 4.2%） */
  annualRate: number;
  /** 期限（月数，>=1） */
  termMonths: number;
  /** 还款方式 */
  method: LoanMethod;
  /** 首次还款日（YYYY-MM-DD） */
  startDate: string;
}

/** 更新贷款请求（全部可选，对齐 UpdateLoanDto） */
export type UpdateLoanRequest = Partial<CreateLoanRequest>;

/** 生成还款交易请求（对齐 GenerateLoanDto） */
export interface GeneratePaymentRequest {
  /** 生成到该日期（含）之前的到期 pending 计划（YYYY-MM-DD） */
  upto?: string;
}

/** 生成结果 */
export interface GeneratePaymentResult {
  /** 本次生成的还款交易条数 */
  generated: number;
}

/** 列表 GET /api/loans?familyId= （含完整还款计划 schedules） */
export function listLoans(familyId: string): Promise<Loan[]> {
  return get<Loan[]>('/loans', { familyId });
}

/** 创建贷款 POST /api/loans */
export function createLoan(data: CreateLoanRequest): Promise<Loan> {
  return post<Loan>('/loans', data);
}

/**
 * 还款计划 GET /api/loans/:id
 * 后端返回贷款主体（含 schedules 数组），因此直接返回 Loan，页面从 loan.schedules 读取计划。
 */
export function getSchedules(loanId: string): Promise<Loan> {
  return get<Loan>(`/loans/${loanId}`);
}

/** 单期/到期生成还款交易 POST /api/loans/:id/generate */
export function generatePayment(loanId: string, data: GeneratePaymentRequest = {}): Promise<GeneratePaymentResult> {
  return post<GeneratePaymentResult>(`/loans/${loanId}/generate`, data);
}

/** 删除贷款 DELETE /api/loans/:id（级联删除还款计划） */
export function deleteLoan(loanId: string): Promise<{ success: boolean }> {
  return del(`/loans/${loanId}`);
}

/** 还款计划明细类型（再导出，方便页面引用） */
export type { LoanSchedule };

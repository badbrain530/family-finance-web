import { get, post, put, del } from './api';
import type {
  Transaction,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  TransactionQueryParams,
  QuickRecordRequest,
} from '@/types/transaction';
import type { PaginatedData, BatchResult, QuickRecordResult } from '@/types/api';

/**
 * 交易API服务
 */

/** 交易列表（分页+筛选） */
export function getTransactions(params: TransactionQueryParams): Promise<PaginatedData<Transaction>> {
  return get<PaginatedData<Transaction>>('/transactions', params);
}

/** 创建交易 */
export function createTransaction(data: CreateTransactionRequest): Promise<Transaction> {
  return post<Transaction>('/transactions', data);
}

/** 批量创建交易 */
export function batchCreateTransactions(transactions: CreateTransactionRequest[]): Promise<BatchResult> {
  return post<BatchResult>('/transactions/batch', { transactions });
}

/** 交易详情 */
export function getTransaction(id: string): Promise<Transaction> {
  return get<Transaction>(`/transactions/${id}`);
}

/** 更新交易 */
export function updateTransaction(id: string, data: UpdateTransactionRequest): Promise<Transaction> {
  return put<Transaction>(`/transactions/${id}`, data);
}

/** 删除交易 */
export function deleteTransaction(id: string): Promise<{ success: boolean }> {
  return del(`/transactions/${id}`);
}

/** 批量删除 */
export function batchDeleteTransactions(ids: string[]): Promise<BatchResult> {
  return post<BatchResult>('/transactions/batch/delete', { ids });
}

/** 批量修改分类 */
export function batchClassifyTransactions(ids: string[], categoryId: string): Promise<BatchResult> {
  return post<BatchResult>('/transactions/batch/classify', { ids, categoryId });
}

/** Ctrl+K快捷记账 */
export function quickRecord(data: QuickRecordRequest): Promise<QuickRecordResult> {
  return post<QuickRecordResult>('/transactions/quick', data);
}

/** 纠正分类（AI学习） */
export function correctTransactionCategory(id: string, categoryId: string): Promise<{ success: boolean }> {
  return post(`/transactions/${id}/correct`, { categoryId });
}

/** 撤销最近记账 */
export function undoTransaction(id: string, undoToken: string): Promise<{ success: boolean }> {
  return post(`/transactions/${id}/undo`, { undoToken });
}

/** 清空某家庭下全部交易数据（设置页「危险操作」调用） */
export function clearAllTransactions(data: { familyId: string; confirm: boolean }): Promise<{ deleted: number }> {
  return post<{ deleted: number }>('/transactions/clear', data);
}

// ==================== 二期：退款 / 报销 / 分期 ====================

/** 退款：为指定支出生成反向 INCOME 交易 */
export function refundTransaction(
  id: string,
  data: { amount: number; date: string; accountId?: string | null; note?: string },
): Promise<{ original: Transaction; refund: Transaction }> {
  return post(`/transactions/${id}/refund`, data);
}

/** 标记待报销 */
export function markReimbursement(id: string, source?: 'family' | 'company'): Promise<Transaction> {
  return post(`/transactions/${id}/reimbursement/mark`, { source });
}

/** 取消待报销 */
export function cancelReimbursement(id: string): Promise<Transaction> {
  return post(`/transactions/${id}/reimbursement/cancel`, {});
}

/** 确认报销：生成 INCOME 反向交易 */
export function confirmReimbursement(
  id: string,
  data: { date: string; accountId?: string | null; note?: string },
): Promise<{ original: Transaction; reimbursement: Transaction }> {
  return post(`/transactions/${id}/reimbursement/confirm`, data);
}

/** 分期付款：一次生成 N 笔 EXPENSE */
export function createInstallment(data: {
  ledgerId: string;
  categoryId?: string | null;
  accountId: string;
  totalAmount: number;
  periods: number;
  startMonth: string;
  merchant?: string;
  note?: string;
}): Promise<{ groupId: string; transactions: Transaction[] }> {
  return post('/transactions/installment', data);
}

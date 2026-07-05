/**
 * 交易/分类类型定义
 */

/** 交易类型枚举 */
export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
  TRANSFER = 'transfer',
}

/** 交易来源枚举 */
export enum TransactionSource {
  MANUAL = 'manual',
  QUICK_RECORD = 'quick_record',
  IMPORT = 'import',
  VOICE = 'voice',
}

/** 分类 */
export interface Category {
  id: string;
  familyId: string;
  parentId: string | null;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  isSystem: boolean;
  createdAt: string;
  /** 子分类（树形结构） */
  children?: Category[];
}

/** 交易记录 */
export interface Transaction {
  id: string;
  ledgerId: string;
  userId: string;
  categoryId: string | null;
  type: TransactionType;
  amount: number;
  date: string;
  merchant: string | null;
  note: string | null;
  source: TransactionSource;
  importRecordId: string | null;
  aiConfidence: number | null;
  aiCorrected: boolean;
  isLargeExpense: boolean;
  createdAt: string;
  updatedAt: string;
  // 扩展预留字段（MVP阶段即加入）
  currency: string;
  metadata: Record<string, any> | null;
  tags: string[];
  // 关联数据
  category?: Category;
  user?: import('./user').User;
}

/** 创建交易请求 */
export interface CreateTransactionRequest {
  ledgerId: string;
  categoryId?: string;
  type: TransactionType;
  amount: number;
  date: string;
  merchant?: string;
  note?: string;
  source?: TransactionSource;
  currency?: string;
  tags?: string[];
}

/** 更新交易请求 */
export interface UpdateTransactionRequest {
  categoryId?: string;
  type?: TransactionType;
  amount?: number;
  date?: string;
  merchant?: string;
  note?: string;
  tags?: string[];
}

/** 交易查询参数 */
export interface TransactionQueryParams {
  ledgerId?: string;
  categoryId?: string;
  type?: TransactionType;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  keyword?: string;
  memberId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** 快捷记账请求 */
export interface QuickRecordRequest {
  input: string;
  ledgerId: string;
}

/** 批量操作请求 */
export interface BatchDeleteRequest {
  ids: string[];
}

export interface BatchClassifyRequest {
  ids: string[];
  categoryId: string;
}

/** 创建分类请求 */
export interface CreateCategoryRequest {
  name: string;
  parentId?: string;
  icon: string;
  color: string;
}

/** 重排序分类请求 */
export interface ReorderCategoriesRequest {
  items: Array<{ id: string; sortOrder: number }>;
}

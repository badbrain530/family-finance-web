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
  /**
   * 分类图标。可存 lucide 图标名（如 'utensils'）或设计师图标 key（见
   * features/categories/categoryIconMeta.ts 的 CategoryIconKey，如 'dining'）。
   * 前端统一经 CategoryIcon / getCategoryIcon 双轨解析为对应渲染组件。
   */
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
  /** 账户ID（账户管理增量，可空：历史交易允许为空；既有代码构造时未必包含，故可选） */
  accountId?: string | null;
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
  // ===== 二期扩展字段（退款/报销/分期） =====
  installmentGroupId?: string | null;
  installmentSeq?: number | null;
  installmentTotal?: number | null;
  refundOfId?: string | null;
  refundedAmount?: number | null;
  refundStatus?: 'NONE' | 'PARTIAL' | 'FULL';
  reimbursementOfId?: string | null;
  reimbursementStatus?: 'NONE' | 'PENDING' | 'REIMBURSED';
  // 关联数据
  category?: Category;
  account?: import('./account').Account;
  user?: import('./user').User;
}

/** 退款状态枚举 */
export enum RefundStatus {
  NONE = 'NONE',
  PARTIAL = 'PARTIAL',
  FULL = 'FULL',
}

/** 报销状态枚举 */
export enum ReimburseStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  REIMBURSED = 'REIMBURSED',
}

/** 周期频率 */
export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/** 还款方式 */
export type LoanMethod = 'EQUAL_INSTALLMENT' | 'EQUAL_PRINCIPAL';

/** 周期规则 */
export interface RecurringRule {
  id: string;
  familyId: string;
  ledgerId: string;
  userId: string;
  categoryId: string | null;
  accountId: string | null;
  type: TransactionType;
  amount: number;
  merchant: string | null;
  note: string | null;
  frequency: Frequency;
  interval: number;
  weekday: number | null;
  monthDay: number | null;
  startDate: string;
  endDate: string | null;
  nextRunAt: string;
  isActive: boolean;
  createdAt: string;
}

/** 贷款还款计划明细 */
export interface LoanSchedule {
  id: string;
  loanId: string;
  seq: number;
  dueDate: string;
  payment: number;
  principalPart: number;
  interestPart: number;
  remainingPrincipal: number;
  generatedTxId: string | null;
  status: 'pending' | 'paid' | 'skipped';
}

/** 贷款 */
export interface Loan {
  id: string;
  familyId: string;
  ledgerId: string;
  accountId: string | null;
  name: string;
  principal: number;
  annualRate: number;
  termMonths: number;
  method: LoanMethod;
  startDate: string;
  isActive: boolean;
  createdAt: string;
  schedules?: LoanSchedule[];
}

/** 备份载荷 */
export interface BackupPayload {
  version: string;
  exportedAt: string;
  familyId: string;
  data: {
    ledgers: any[];
    categories: any[];
    accounts: any[];
    transactions: any[];
    budgets: any[];
    wish_goals: any[];
    monthly_reports: any[];
  };
}

/** 创建交易请求 */
export interface CreateTransactionRequest {
  ledgerId: string;
  categoryId?: string;
  /** 账户ID（可空） */
  accountId?: string | null;
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
  /** 账户ID（可空，取消关联时传 null） */
  accountId?: string | null;
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
  /** 功能C：按账户筛选交易 */
  accountId?: string;
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
  // ===== 二期扩展筛选（与后端 QueryTransactionDto 严格一致） =====
  /** 退款状态筛选 */
  refundStatus?: 'NONE' | 'PARTIAL' | 'FULL';
  /** 报销状态筛选 */
  reimbursementStatus?: 'NONE' | 'PENDING' | 'REIMBURSED';
  /** 是否参与分期（installmentGroupId 不为空） */
  hasInstallment?: boolean;
}

/** 快捷记账请求 */
export interface QuickRecordRequest {
  input: string;
  ledgerId: string;
  /** 关联账户ID（快捷记账强制选择，用于账户流水与余额统计） */
  accountId?: string;
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
  /** 图标。可存 lucide 图标名或设计师图标 key（见 categoryIconMeta.ts 的 CategoryIconKey），由 CategoryIcon/getCategoryIcon 解析 */
  icon: string;
  color: string;
}

/** 重排序分类请求 */
export interface ReorderCategoriesRequest {
  items: Array<{ id: string; sortOrder: number }>;
}

/**
 * API响应/请求类型定义
 * 统一API响应格式：{ code, data, message }
 */

/** 统一API成功响应 */
export interface ApiResponse<T = any> {
  code: number;
  data: T;
  message: string;
}

/** 统一API失败响应 */
export interface ApiErrorResponse {
  code: number;
  data: null;
  message: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

/** 分页响应数据 */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 分页查询参数 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/** 排序参数 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** 批量操作结果 */
export interface BatchResult {
  successCount: number;
  failedCount: number;
}

/** 快捷记账结果 */
export interface QuickRecordResult {
  transaction: import('./transaction').Transaction;
  confidence: number;
  undoToken: string;
  needConfirm?: boolean;
  parsedData?: Partial<import('./transaction').Transaction>;
}

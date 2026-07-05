/**
 * 账单导入相关类型定义
 */

/** 导入平台枚举 */
export enum ImportPlatform {
  ALIPAY = 'alipay',
  WECHAT = 'wechat',
  CMB = 'cmb',
  ICBC = 'icbc',
  CCB = 'ccb',
}

/** 导入状态枚举 */
export enum ImportStatus {
  PENDING = 'pending',
  PARSING = 'parsing',
  PREVIEW = 'preview',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

/** 导入记录 */
export interface ImportRecord {
  id: string;
  userId: string;
  familyId: string;
  ledgerId: string;
  platform: ImportPlatform;
  fileName: string;
  fileUrl: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  aiAccuracy: number | null;
  status: ImportStatus;
  errorMessage: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

/** 解析后的交易（预览数据） */
export interface ParsedTransaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  type: import('./transaction').TransactionType;
  categoryId: string | null;
  categoryName: string | null;
  aiConfidence: number | null;
  note: string | null;
  isValid: boolean;
  errorMessage?: string;
}

/** 上传账单请求 */
export interface UploadBillRequest {
  platform: ImportPlatform;
  familyId: string;
  ledgerId: string;
}

/** 确认导入请求 */
export interface ConfirmImportRequest {
  corrections: Array<{
    id: string;
    categoryId: string;
  }>;
}

/** 导入摘要 */
export interface ImportSummary {
  successCount: number;
  failedCount: number;
  aiAccuracy: number;
}

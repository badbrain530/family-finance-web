/**
 * 账户相关类型定义
 * 与后端 schema.prisma Account 模型、accounts 模块接口保持一致
 */

/** 账户类型枚举（与后端 AccountType 大写字符串值一致） */
export enum AccountType {
  DEBIT = 'DEBIT', // 储蓄卡
  CREDIT = 'CREDIT', // 信用卡
  INVESTMENT = 'INVESTMENT', // 投资
  CASH = 'CASH', // 现金
  E_WALLET = 'E_WALLET', // 钱包（支付宝/微信）
  VIRTUAL = 'VIRTUAL', // 虚拟
}

/** 账户记录 */
export interface Account {
  id: string;
  familyId: string;
  ledgerId: string | null;
  userId: string;
  type: AccountType;
  name: string;
  /** 余额/欠款（信用卡为当前欠款），number 由后端 Decimal→Number 转换 */
  balance: number;
  institution: string | null;
  /** 卡号后4位 */
  lastFourDigits: string | null;
  /** 信用卡授信额度 */
  creditLimit: number | null;
  /** 账单日 1-31（短月按当月最后一天计） */
  billingDay: number | null;
  /** 还款日 1-31（短月按当月最后一天计） */
  paymentDueDay: number | null;
  /** 信用卡可用额度 = 授信 - 欠款（后端计算，仅信用卡有值） */
  availableCredit: number | null;
  /** 投资/钱包平台 */
  platform: string | null;
  /** 虚拟账户用途 */
  purpose: string | null;
  currency: string;
  /** 是否启用（停用不删除，决策#3） */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 创建账户请求 */
export interface CreateAccountRequest {
  familyId: string;
  type: AccountType;
  name: string;
  balance: number;
  institution?: string;
  lastFourDigits?: string;
  creditLimit?: number;
  billingDay?: number;
  paymentDueDay?: number;
  platform?: string;
  purpose?: string;
  currency?: string;
  ledgerId?: string | null;
}

/** 更新账户请求（全字段可选） */
export interface UpdateAccountRequest {
  type?: AccountType;
  name?: string;
  balance?: number;
  institution?: string;
  lastFourDigits?: string;
  creditLimit?: number;
  billingDay?: number;
  paymentDueDay?: number;
  platform?: string;
  purpose?: string;
  currency?: string;
  ledgerId?: string | null;
  isActive?: boolean;
}

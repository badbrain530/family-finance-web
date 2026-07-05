/**
 * AI分类结果DTO
 * 描述单笔交易的分类结果
 */

/**
 * 分类来源
 * - rule: 规则引擎匹配（关键词）
 * - llm: LLM分类（规则未命中时兜底）
 * - none: 未分类
 */
export type ClassificationSource = 'rule' | 'llm' | 'none';

/**
 * 分类请求DTO
 */
export interface ClassificationRequest {
  /** 交易描述 */
  description: string;
  /** 商户名 */
  merchant: string;
  /** 金额 */
  amount: number;
  /** 交易类型 */
  type: 'income' | 'expense';
  /** 家庭ID（用于查询该家庭的分类体系） */
  familyId: string;
}

/**
 * 分类结果DTO
 */
export interface ClassificationResultDto {
  /** 分类ID（null表示未匹配到分类） */
  categoryId: string | null;
  /** 分类名称 */
  categoryName: string | null;
  /** 置信度（0-1） */
  confidence: number;
  /** 分类来源 */
  source: ClassificationSource;
}

/**
 * 分类反馈DTO
 * 用户纠正分类时保存反馈数据
 */
export interface ClassificationFeedbackDto {
  /** 交易ID */
  transactionId: string;
  /** 用户ID */
  userId: string;
  /** 原始AI分类ID */
  originalCategoryId: string | null;
  /** 用户纠正后的分类ID */
  correctedCategoryId: string;
  /** 商户名 */
  merchant: string;
  /** 金额 */
  amount: number;
}

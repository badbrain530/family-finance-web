import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 快捷记账DTO（Ctrl+K 自然语言记账）
 * 用户输入自然语言文本，后端NLP解析为结构化交易数据
 */
export class QuickRecordDto {
  /** 自然语言输入（如"午饭28块"、"打车去机场花了45元"） */
  @IsNotEmpty({ message: '输入内容不能为空' })
  @IsString()
  @MaxLength(200, { message: '输入内容最多200个字符' })
  readonly input: string;

  /** 账本ID */
  @IsNotEmpty({ message: '账本ID不能为空' })
  @IsString()
  readonly ledgerId: string;

  /** 关联账户ID（前端快捷记账强制选择，用于账户流水与余额统计） */
  @IsOptional()
  @IsString()
  readonly accountId?: string;
}

/**
 * NLP解析结果
 */
export interface ParsedTransaction {
  amount: number;         // 金额
  type: 'income' | 'expense';  // 类型
  categoryKeyword: string;     // 分类关键词
  note: string;                // 备注
  date: Date;                  // 交易日期
  merchant: string | null;     // 商户名
  confidence: number;          // AI分类置信度 0-1
  needConfirm: boolean;        // 是否需要用户确认
}

/**
 * 快捷记账返回结果
 */
export interface QuickRecordResult {
  transaction: {
    id: string;
    ledgerId: string;
    type: string;
    amount: number;
    date: string;
    merchant: string | null;
    note: string | null;
    categoryId: string | null;
    source: string;
    aiConfidence: number | null;
    createdAt: string;
  };
  confidence: number;
  undoToken: string;  // 撤销令牌（5分钟有效）
}

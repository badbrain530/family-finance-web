import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsIn,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/** 交易类型 */
export type TransactionType = 'income' | 'expense' | 'transfer';

/** 交易来源 */
export type TransactionSource = 'manual' | 'quick_record' | 'import' | 'voice';

/**
 * 创建交易DTO
 */
export class CreateTransactionDto {
  /** 账本ID */
  @IsNotEmpty({ message: '账本ID不能为空' })
  @IsString()
  readonly ledgerId: string;

  /** 分类ID */
  @IsOptional()
  @IsString()
  readonly categoryId?: string | null;

  /** 账户ID（账户管理增量，可空：历史交易允许为空，决策#1） */
  @IsOptional()
  @IsString()
  readonly accountId?: string | null;

  /** 交易类型：income/expense/transfer */
  @IsNotEmpty({ message: '交易类型不能为空' })
  @IsIn(['income', 'expense', 'transfer'], { message: '交易类型必须为 income/expense/transfer' })
  readonly type: TransactionType;

  /** 金额（正数，单位元） */
  @IsNotEmpty({ message: '金额不能为空' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '金额最多2位小数' })
  @Min(0.01, { message: '金额必须大于0' })
  readonly amount: number;

  /** 交易日期（ISO 8601） */
  @IsNotEmpty({ message: '交易日期不能为空' })
  @IsDateString({}, { message: '日期格式不正确' })
  readonly date: string;

  /** 商户名 */
  @IsOptional()
  @IsString()
  readonly merchant?: string;

  /** 备注 */
  @IsOptional()
  @IsString()
  readonly note?: string;

  /** 来源 */
  @IsOptional()
  @IsIn(['manual', 'quick_record', 'import', 'voice'])
  readonly source?: TransactionSource;

  /** 导入记录ID */
  @IsOptional()
  @IsString()
  readonly importRecordId?: string;

  /** AI分类置信度 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  readonly aiConfidence?: number;

  /** 自定义标签 */
  @IsOptional()
  readonly tags?: string[];
}

/**
 * 更新交易DTO
 */
export class UpdateTransactionDto {
  @IsOptional()
  @IsString()
  readonly categoryId?: string | null;

  /** 账户ID（账户管理增量，可空） */
  @IsOptional()
  @IsString()
  readonly accountId?: string | null;

  @IsOptional()
  @IsIn(['income', 'expense', 'transfer'])
  readonly type?: TransactionType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  readonly amount?: number;

  @IsOptional()
  @IsDateString()
  readonly date?: string;

  @IsOptional()
  @IsString()
  readonly merchant?: string;

  @IsOptional()
  @IsString()
  readonly note?: string;

  @IsOptional()
  readonly tags?: string[];
}

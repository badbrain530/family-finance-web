/**
 * 确认导入DTO
 * 用户确认预览数据后，将交易批量写入数据库
 */
import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 单条确认交易（含用户可能纠正的分类）
 */
export class ConfirmTransactionItem {
  /** 交易日期 */
  @IsString()
  @IsNotEmpty()
  date: string;

  /** 金额（正数） */
  @IsNumber()
  amount: number;

  /** 交易类型 */
  @IsString()
  @IsNotEmpty()
  type: 'income' | 'expense';

  /** 交易描述 */
  @IsString()
  description: string;

  /** 商户名 */
  @IsOptional()
  @IsString()
  merchant?: string | null;

  /** 用户确认/纠正的分类ID */
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  /** AI分类置信度（0-1） */
  @IsOptional()
  @IsNumber()
  aiConfidence?: number;

  /** AI分类来源（rule/llm/user） */
  @IsOptional()
  @IsString()
  classificationSource?: string;

  /** 是否被用户纠正过 */
  @IsOptional()
  @IsBoolean()
  aiCorrected?: boolean;

  /** 交易号（用于去重） */
  @IsOptional()
  @IsString()
  transactionNo?: string | null;

  /** 支付方式 */
  @IsOptional()
  @IsString()
  paymentMethod?: string | null;
}

export class ConfirmImportDto {
  /** 导入记录ID */
  @IsString()
  @IsNotEmpty({ message: '导入记录ID不能为空' })
  importId: string;

  /** 账本ID */
  @IsString()
  @IsNotEmpty({ message: '账本ID不能为空' })
  ledgerId: string;

  /** 确认导入的交易列表 */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmTransactionItem)
  transactions: ConfirmTransactionItem[];
}

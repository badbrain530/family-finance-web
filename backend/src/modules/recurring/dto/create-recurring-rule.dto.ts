import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 创建/更新周期规则DTO
 */
export class CreateRecurringRuleDto {
  /** 账本ID */
  @IsNotEmpty({ message: '账本ID不能为空' })
  @IsString()
  readonly ledgerId: string;

  /** 分类ID */
  @IsOptional()
  @IsString()
  readonly categoryId?: string | null;

  /** 关联账户（生成交易时带入，P1 生效） */
  @IsOptional()
  @IsString()
  readonly accountId?: string | null;

  /** 交易类型 */
  @IsIn(['income', 'expense'])
  readonly type: 'income' | 'expense';

  /** 金额（元） */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '金额最多2位小数' })
  @Min(0.01, { message: '金额必须大于0' })
  readonly amount: number;

  /** 商户名 */
  @IsOptional()
  @IsString()
  readonly merchant?: string;

  /** 备注 */
  @IsOptional()
  @IsString()
  readonly note?: string;

  /** 频率 */
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'])
  readonly frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

  /** 间隔（默认1） */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  readonly interval?: number;

  /** WEEKLY：星期几 1-7 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(7)
  readonly weekday?: number;

  /** MONTHLY：几号 1-31 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(31)
  readonly monthDay?: number;

  /** 起始日（首次生成不早于该日） */
  @IsDateString({}, { message: '起始日格式不正确' })
  readonly startDate: string;

  /** 结束日（可选） */
  @IsOptional()
  @IsDateString()
  readonly endDate?: string;
}

/** 更新规则DTO（全可选） */
export class UpdateRecurringRuleDto {
  @IsOptional()
  @IsString()
  readonly ledgerId?: string;

  @IsOptional()
  @IsString()
  readonly categoryId?: string | null;

  @IsOptional()
  @IsString()
  readonly accountId?: string | null;

  @IsOptional()
  @IsIn(['income', 'expense'])
  readonly type?: 'income' | 'expense';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  readonly amount?: number;

  @IsOptional()
  @IsString()
  readonly merchant?: string;

  @IsOptional()
  @IsString()
  readonly note?: string;

  @IsOptional()
  @IsIn(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'])
  readonly frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  readonly interval?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(7)
  readonly weekday?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(31)
  readonly monthDay?: number;

  @IsOptional()
  @IsDateString()
  readonly startDate?: string;

  @IsOptional()
  @IsDateString()
  readonly endDate?: string;

  @IsOptional()
  @Type(() => Boolean)
  readonly isActive?: boolean;
}

/**
 * 手动补生成请求
 */
export class GenerateRecurringDto {
  @IsNotEmpty({ message: 'familyId 必填' })
  @IsString()
  readonly familyId: string;

  /** 生成到该时间（含）之前到期且未生成的项，默认 now */
  @IsOptional()
  @IsDateString()
  readonly before?: string;
}

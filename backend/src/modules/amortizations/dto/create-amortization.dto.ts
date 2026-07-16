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

/**
 * 待摊/预付 DTO
 */
export class CreateAmortizationDto {
  /** 账本ID */
  @IsNotEmpty({ message: '账本ID不能为空' })
  @IsString()
  readonly ledgerId: string;

  /** 关联账户（初始入账账户，可空） */
  @IsOptional()
  @IsString()
  readonly accountId?: string | null;

  /** 名称（如「年费」「装修」） */
  @IsNotEmpty({ message: '名称不能为空' })
  @IsString()
  readonly name: string;

  /** 总金额（元） */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '金额最多2位小数' })
  @Min(0.01, { message: '金额必须大于0' })
  readonly totalAmount: number;

  /** 摊销期数（月） */
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: '期数至少为1' })
  readonly periodMonths: number;

  /** 类型：PREPAID 预付 / DEFERRED 待摊 */
  @IsIn(['PREPAID', 'DEFERRED'])
  readonly type: 'PREPAID' | 'DEFERRED';

  /** 分类ID（可空） */
  @IsOptional()
  @IsString()
  readonly categoryId?: string | null;

  /** 开始日期（YYYY-MM-DD，初始入账日） */
  @IsDateString({}, { message: '日期格式不正确' })
  readonly startDate: string;

  /** 备注 */
  @IsOptional()
  @IsString()
  readonly note?: string;
}

/** 更新待摊/预付DTO（全部可选） */
export class UpdateAmortizationDto {
  @IsOptional()
  @IsString()
  readonly ledgerId?: string;

  @IsOptional()
  @IsString()
  readonly accountId?: string | null;

  @IsOptional()
  @IsString()
  readonly name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  readonly totalAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  readonly periodMonths?: number;

  @IsOptional()
  @IsIn(['PREPAID', 'DEFERRED'])
  readonly type?: 'PREPAID' | 'DEFERRED';

  @IsOptional()
  @IsString()
  readonly categoryId?: string | null;

  @IsOptional()
  @IsDateString()
  readonly startDate?: string;

  @IsOptional()
  @IsString()
  readonly note?: string;
}

/** 生成摊销交易DTO */
export class GenerateAmortizationDto {
  @IsOptional()
  @IsDateString()
  readonly upto?: string;
}

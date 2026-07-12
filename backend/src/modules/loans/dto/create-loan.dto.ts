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
 * 创建/更新贷款DTO
 */
export class CreateLoanDto {
  /** 账本ID */
  @IsNotEmpty({ message: '账本ID不能为空' })
  @IsString()
  readonly ledgerId: string;

  /** 关联账户（还款扣款账户，可空） */
  @IsOptional()
  @IsString()
  readonly accountId?: string | null;

  /** 贷款名称（如「房贷」「车贷」） */
  @IsNotEmpty({ message: '贷款名称不能为空' })
  @IsString()
  readonly name: string;

  /** 贷款本金（元） */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '本金最多2位小数' })
  @Min(0.01, { message: '本金必须大于0' })
  readonly principal: number;

  /** 年利率（如 4.2 表示 4.2%） */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0, { message: '年利率不能为负' })
  readonly annualRate: number;

  /** 期限（月数） */
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: '期数至少为1' })
  readonly termMonths: number;

  /** 还款方式 */
  @IsIn(['EQUAL_INSTALLMENT', 'EQUAL_PRINCIPAL'])
  readonly method: 'EQUAL_INSTALLMENT' | 'EQUAL_PRINCIPAL';

  /** 首次还款日（YYYY-MM-DD） */
  @IsDateString({}, { message: '日期格式不正确' })
  readonly startDate: string;
}

/** 更新贷款DTO（全部可选） */
export class UpdateLoanDto {
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
  readonly principal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  readonly annualRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  readonly termMonths?: number;

  @IsOptional()
  @IsIn(['EQUAL_INSTALLMENT', 'EQUAL_PRINCIPAL'])
  readonly method?: 'EQUAL_INSTALLMENT' | 'EQUAL_PRINCIPAL';

  @IsOptional()
  @IsDateString()
  readonly startDate?: string;
}

/**
 * 生成还款交易DTO
 */
export class GenerateLoanDto {
  /** 生成到该日期（含）之前的到期 pending 计划 */
  @IsOptional()
  @IsDateString()
  readonly upto?: string;
}

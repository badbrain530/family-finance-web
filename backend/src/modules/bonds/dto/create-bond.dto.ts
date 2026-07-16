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
 * 债券 DTO（仅 HELD 持有方；无 side 字段）
 */
export class CreateBondDto {
  /** 账本ID */
  @IsNotEmpty({ message: '账本ID不能为空' })
  @IsString()
  readonly ledgerId: string;

  /** 关联账户（付息入账账户，可空） */
  @IsOptional()
  @IsString()
  readonly accountId?: string | null;

  /** 债券名称（如「国债2026」） */
  @IsNotEmpty({ message: '债券名称不能为空' })
  @IsString()
  readonly name: string;

  /** 面值（元） */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '面值最多2位小数' })
  @Min(0.01, { message: '面值必须大于0' })
  readonly faceValue: number;

  /** 年利率（如 4.2 表示 4.2%） */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0, { message: '年利率不能为负' })
  readonly annualRate: number;

  /** 期限（月数） */
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: '期限至少为1' })
  readonly termMonths: number;

  /** 还款方式（仅占位，债券票息固定） */
  @IsIn(['EQUAL_INSTALLMENT', 'EQUAL_PRINCIPAL'])
  readonly method: 'EQUAL_INSTALLMENT' | 'EQUAL_PRINCIPAL';

  /** 付息频率 */
  @IsIn(['MONTHLY', 'QUARTERLY', 'SEMI', 'ANNUAL'])
  readonly couponFrequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI' | 'ANNUAL';

  /** 起息日（YYYY-MM-DD） */
  @IsDateString({}, { message: '日期格式不正确' })
  readonly startDate: string;

  /** 分类ID（可空） */
  @IsOptional()
  @IsString()
  readonly categoryId?: string | null;
}

/** 更新债券DTO（全部可选） */
export class UpdateBondDto {
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
  readonly faceValue?: number;

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
  @IsIn(['MONTHLY', 'QUARTERLY', 'SEMI', 'ANNUAL'])
  readonly couponFrequency?: 'MONTHLY' | 'QUARTERLY' | 'SEMI' | 'ANNUAL';

  @IsOptional()
  @IsDateString()
  readonly startDate?: string;

  @IsOptional()
  @IsString()
  readonly categoryId?: string | null;
}

/** 生成票息交易DTO */
export class GenerateBondDto {
  /** 生成到该日期（含）之前的到期 pending 计划 */
  @IsOptional()
  @IsDateString()
  readonly upto?: string;
}

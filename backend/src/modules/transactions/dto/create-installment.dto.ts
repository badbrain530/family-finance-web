import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 分期付款创建DTO
 * 一次生成 N 笔独立 EXPENSE 交易（同 installmentGroupId，seq=1..N，日期按月递增）
 */
export class CreateInstallmentDto {
  /** 账本ID */
  @IsNotEmpty({ message: '账本ID不能为空' })
  @IsString()
  readonly ledgerId: string;

  /** 分类ID */
  @IsOptional()
  @IsString()
  readonly categoryId?: string | null;

  /** 关联账户（信用卡等） */
  @IsNotEmpty({ message: '账户ID不能为空' })
  @IsString()
  readonly accountId: string;

  /** 分期总金额（元） */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '金额最多2位小数' })
  @Min(0.01, { message: '金额必须大于0' })
  readonly totalAmount: number;

  /** 分期期数 */
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: '期数至少为1' })
  @Max(360, { message: '期数过多' })
  readonly periods: number;

  /** 起始月份（YYYY-MM） */
  @IsNotEmpty({ message: '起始月份不能为空' })
  @IsDateString({}, { message: '起始月份格式应为 YYYY-MM' })
  readonly startMonth: string;

  /** 商户名 */
  @IsOptional()
  @IsString()
  readonly merchant?: string;

  /** 备注 */
  @IsOptional()
  @IsString()
  readonly note?: string;
}

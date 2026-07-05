import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 创建预算DTO
 * categoryId为null表示总预算，指定categoryId表示分类预算
 */
export class CreateBudgetDto {
  /** 分类ID（可选，null表示总预算） */
  @IsOptional()
  @IsString()
  readonly categoryId?: string | null;

  /** 预算金额（正数，单位元） */
  @IsNotEmpty({ message: '预算金额不能为空' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '金额最多2位小数' })
  @Min(0.01, { message: '金额必须大于0' })
  readonly amount: number;

  /** 年份 */
  @IsNotEmpty({ message: '年份不能为空' })
  @Type(() => Number)
  @IsInt({ message: '年份必须为整数' })
  @Min(2020, { message: '年份不合法' })
  @Max(2100, { message: '年份不合法' })
  readonly year: number;

  /** 月份（1-12） */
  @IsNotEmpty({ message: '月份不能为空' })
  @Type(() => Number)
  @IsInt({ message: '月份必须为整数' })
  @Min(1, { message: '月份必须在1-12之间' })
  @Max(12, { message: '月份必须在1-12之间' })
  readonly month: number;

  /** 关联心愿目标ID（可选） */
  @IsOptional()
  @IsString()
  readonly wishGoalId?: string | null;
}

/**
 * 更新预算DTO
 */
export class UpdateBudgetDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  readonly amount?: number;

  @IsOptional()
  @IsString()
  readonly wishGoalId?: string | null;
}

/**
 * 查询预算DTO
 */
export class QueryBudgetDto {
  /** 年份 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  readonly year?: number;

  /** 月份 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  readonly month?: number;
}

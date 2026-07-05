import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 创建心愿目标DTO
 */
export class CreateWishGoalDto {
  /** 心愿目标名称 */
  @IsNotEmpty({ message: '心愿目标名称不能为空' })
  @IsString()
  @MaxLength(50, { message: '名称最多50个字符' })
  readonly name: string;

  /** 目标金额（正数，单位元） */
  @IsNotEmpty({ message: '目标金额不能为空' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '金额最多2位小数' })
  @Min(0.01, { message: '金额必须大于0' })
  readonly targetAmount: number;

  /** 目标完成日期（可选，ISO 8601） */
  @IsOptional()
  @IsDateString({}, { message: '日期格式不正确' })
  readonly targetDate?: string;

  /** 图标（emoji或图标名） */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  readonly icon?: string;

  /** 颜色（hex格式） */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  readonly color?: string;
}

/**
 * 更新心愿目标DTO
 */
export class UpdateWishGoalDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  readonly name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  readonly targetAmount?: number;

  @IsOptional()
  @IsDateString()
  readonly targetDate?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  readonly currentAmount?: number;
}

/**
 * 心愿目标进度
 */
export interface WishGoalProgress {
  id: string;
  name: string;
  currentAmount: number;
  targetAmount: number;
  percentage: number;
  remaining: number;
  targetDate: string | null;
  icon: string;
  color: string;
  isCompleted: boolean;
}

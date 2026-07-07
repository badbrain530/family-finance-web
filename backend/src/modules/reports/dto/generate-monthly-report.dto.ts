/**
 * 生成月报请求DTO
 * POST /api/reports/monthly/generate
 */
import { IsString, IsNotEmpty, IsNumber, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateMonthlyReportDto {
  /** 家庭ID */
  @IsString()
  @IsNotEmpty({ message: 'familyId 不能为空' })
  familyId: string;

  /** 年份（如 2026） */
  @Type(() => Number)
  @IsNumber({}, { message: 'year 必须为数字' })
  @IsInt({ message: 'year 必须为整数' })
  @Min(2000, { message: 'year 不合法' })
  @Max(2100, { message: 'year 不合法' })
  year: number;

  /** 月份（1-12） */
  @Type(() => Number)
  @IsNumber({}, { message: 'month 必须为数字' })
  @IsInt({ message: 'month 必须为整数' })
  @Min(1, { message: 'month 必须在 1-12 之间' })
  @Max(12, { message: 'month 必须在 1-12 之间' })
  month: number;
}

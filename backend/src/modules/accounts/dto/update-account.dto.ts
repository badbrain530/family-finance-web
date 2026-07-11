import {
  IsOptional,
  IsString,
  IsNumber,
  IsIn,
  IsInt,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ACCOUNT_TYPES, AccountTypeValue } from './create-account.dto';

/**
 * 更新账户 DTO
 * 所有字段可选；停用操作另有专用端点（POST /accounts/:id/deactivate）
 */
export class UpdateAccountDto {
  @IsOptional()
  @IsIn(ACCOUNT_TYPES)
  readonly type?: AccountTypeValue;

  @IsOptional()
  @IsString()
  readonly name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: '余额不能为负数' })
  readonly balance?: number;

  @IsOptional()
  @IsString()
  readonly institution?: string;

  @IsOptional()
  @Matches(/^\d{4}$/, { message: '卡号后4位必须为4位数字' })
  readonly lastFourDigits?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: '授信额度不能为负数' })
  readonly creditLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  readonly billingDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  readonly paymentDueDay?: number;

  @IsOptional()
  @IsString()
  readonly platform?: string;

  @IsOptional()
  @IsString()
  readonly purpose?: string;

  @IsOptional()
  @IsString()
  readonly currency?: string;

  @IsOptional()
  @IsString()
  readonly ledgerId?: string | null;

  /** 是否启用（停用走专用端点，也可经此字段直接设置） */
  @IsOptional()
  readonly isActive?: boolean;
}

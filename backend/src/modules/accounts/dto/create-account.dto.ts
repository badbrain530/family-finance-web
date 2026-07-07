import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  IsInt,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 账户类型（与 Prisma schema AccountType 保持一致，大写字符串）
 */
export const ACCOUNT_TYPES = [
  'DEBIT',
  'CREDIT',
  'INVESTMENT',
  'CASH',
  'E_WALLET',
  'VIRTUAL',
] as const;
export type AccountTypeValue = (typeof ACCOUNT_TYPES)[number];

/**
 * 创建账户 DTO
 * 所有金额字段均为正数；信用卡需配合 creditLimit/billingDay/paymentDueDay
 */
export class CreateAccountDto {
  /** 所属家庭ID（前端经 getCurrentFamily 获取后传入） */
  @IsNotEmpty({ message: '家庭ID不能为空' })
  @IsString()
  readonly familyId: string;

  /** 账户类型 */
  @IsNotEmpty({ message: '账户类型不能为空' })
  @IsIn(ACCOUNT_TYPES, { message: '账户类型必须是 DEBIT/CREDIT/INVESTMENT/CASH/E_WALLET/VIRTUAL' })
  readonly type: AccountTypeValue;

  /** 账户名称 */
  @IsNotEmpty({ message: '账户名称不能为空' })
  @IsString()
  readonly name: string;

  /** 当前余额/欠款（正数） */
  @IsNotEmpty({ message: '余额不能为空' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '余额最多2位小数' })
  @Min(0, { message: '余额不能为负数' })
  readonly balance: number;

  /** 发卡/开户机构（储蓄卡/信用卡建议填写） */
  @IsOptional()
  @IsString()
  readonly institution?: string;

  /** 卡号后4位（储蓄卡/信用卡，必须为4位数字） */
  @IsOptional()
  @Matches(/^\d{4}$/, { message: '卡号后4位必须为4位数字' })
  readonly lastFourDigits?: string;

  /** 信用卡授信额度 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: '授信额度不能为负数' })
  readonly creditLimit?: number;

  /** 账单日 1-28 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  readonly billingDay?: number;

  /** 还款日 1-28 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  readonly paymentDueDay?: number;

  /** 投资/钱包平台 */
  @IsOptional()
  @IsString()
  readonly platform?: string;

  /** 虚拟账户用途 */
  @IsOptional()
  @IsString()
  readonly purpose?: string;

  /** 货币（默认 CNY） */
  @IsOptional()
  @IsString()
  readonly currency?: string;

  /** 归属账本（共同账户可为 null，决策#4） */
  @IsOptional()
  @IsString()
  readonly ledgerId?: string | null;
}

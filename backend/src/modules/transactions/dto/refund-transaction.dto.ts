import { IsOptional, IsString, IsNumber, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 退款请求DTO
 * 仅支出交易可退款；生成 type=INCOME 的反向交易（refundOfId 指向原支出）
 */
export class RefundTransactionDto {
  /** 退款金额（正数，单位元） */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '金额最多2位小数' })
  @Min(0.01, { message: '退款金额必须大于0' })
  readonly amount: number;

  /** 退款发生日期（ISO 8601） */
  @IsDateString({}, { message: '日期格式不正确' })
  readonly date: string;

  /** 退款账户（默认取原支出账户，可指定其他账户） */
  @IsOptional()
  @IsString()
  readonly accountId?: string | null;

  /** 备注 */
  @IsOptional()
  @IsString()
  readonly note?: string;
}

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
 * 垫付（应收）DTO
 * 垫付登记：先创建源 EXPENSE 交易，再登记 AdvanceReceivable（sourceTxId 指向该交易）。
 */
export class CreateAdvanceDto {
  /** 账本ID（源支出归属账本） */
  @IsNotEmpty({ message: '账本ID不能为空' })
  @IsString()
  readonly ledgerId: string;

  /** 关联账户（源支出扣款账户，可空） */
  @IsOptional()
  @IsString()
  readonly accountId?: string | null;

  /** 垫付人（家庭成员 user.id） */
  @IsNotEmpty({ message: '垫付人不能为空' })
  @IsString()
  readonly payerId: string;

  /** 债务人姓名 */
  @IsNotEmpty({ message: '债务人姓名不能为空' })
  @IsString()
  readonly debtorName: string;

  /** 债务人类型 */
  @IsIn(['PERSON', 'COMPANY', 'FAMILY'])
  readonly debtorType: 'PERSON' | 'COMPANY' | 'FAMILY';

  /** 垫付金额（元） */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '金额最多2位小数' })
  @Min(0.01, { message: '金额必须大于0' })
  readonly amount: number;

  /** 约定归还日（可空） */
  @IsOptional()
  @IsDateString()
  readonly dueDate?: string;

  /** 分类ID（可空） */
  @IsOptional()
  @IsString()
  readonly categoryId?: string | null;

  /** 备注 */
  @IsOptional()
  @IsString()
  readonly note?: string;
}

/** 收回垫付请求DTO */
export class CollectAdvanceDto {
  /** 本次收回金额（元，可部分） */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '金额最多2位小数' })
  @Min(0.01, { message: '金额必须大于0' })
  readonly amount: number;

  /** 到账日期（ISO 8601） */
  @IsDateString({}, { message: '日期格式不正确' })
  readonly date: string;

  /** 入账账户（默认取源垫付账户） */
  @IsOptional()
  @IsString()
  readonly accountId?: string | null;
}

/** 更新垫付请求DTO（全部可选） */
export class UpdateAdvanceDto {
  @IsOptional()
  @IsString()
  readonly debtorName?: string;

  @IsOptional()
  @IsDateString()
  readonly dueDate?: string;

  @IsOptional()
  @IsString()
  readonly note?: string;
}

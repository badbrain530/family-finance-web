import { IsOptional, IsString, IsDateString, IsIn } from 'class-validator';

/**
 * 标记待报销请求DTO
 * 仅设置 reimbursementStatus=PENDING（不生成交易）
 */
export class MarkReimbursementDto {
  /** 报销来源：家庭共同账户 / 公司或外部 */
  @IsOptional()
  @IsIn(['family', 'company'])
  readonly source?: 'family' | 'company';
}

/**
 * 确认报销请求DTO
 * 生成 type=INCOME 反向交易（reimbursementOfId 指向原支出），原交易置 REIMBURSED
 */
export class ConfirmReimbursementDto {
  /** 报销到账日期（ISO 8601） */
  @IsDateString({}, { message: '日期格式不正确' })
  readonly date: string;

  /** 报销入账账户（默认取原支出账户） */
  @IsOptional()
  @IsString()
  readonly accountId?: string | null;

  /** 备注 */
  @IsOptional()
  @IsString()
  readonly note?: string;
}

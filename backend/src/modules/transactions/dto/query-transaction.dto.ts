import { IsOptional, IsString, IsNumber, IsDateString, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 交易查询筛选DTO
 * 支持多维度筛选和分页
 */
export class QueryTransactionDto {
  /** 账本ID */
  @IsOptional()
  @IsString()
  readonly ledgerId?: string;

  /** 分类ID */
  @IsOptional()
  @IsString()
  readonly categoryId?: string;

  /** 账户ID（功能C：按账户筛选交易） */
  @IsOptional()
  @IsString()
  readonly accountId?: string;

  /** 交易类型 */
  @IsOptional()
  @IsIn(['income', 'expense', 'transfer'])
  readonly type?: string;

  /** 日期范围-开始 */
  @IsOptional()
  @IsDateString()
  readonly dateFrom?: string;

  /** 日期范围-结束 */
  @IsOptional()
  @IsDateString()
  readonly dateTo?: string;

  /** 金额范围-最小值 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  readonly minAmount?: number;

  /** 金额范围-最大值 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  readonly maxAmount?: number;

  /** 关键词搜索（商户名/备注） */
  @IsOptional()
  @IsString()
  readonly keyword?: string;

  /** 记账人ID */
  @IsOptional()
  @IsString()
  readonly memberId?: string;

  /** 页码（从1开始） */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  readonly page?: number;

  /** 每页条数 */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  readonly pageSize?: number;

  /** 排序字段 */
  @IsOptional()
  @IsIn(['date', 'amount', 'createdAt'])
  readonly sortBy?: string;

  /** 排序方向 */
  @IsOptional()
  @IsIn(['asc', 'desc'])
  readonly sortOrder?: string;

  // ===== 二期扩展筛选（whitelist 必需） =====

  /** 退款状态筛选 */
  @IsOptional()
  @IsIn(['NONE', 'PARTIAL', 'FULL'])
  readonly refundStatus?: string;

  /** 报销状态筛选 */
  @IsOptional()
  @IsIn(['NONE', 'PENDING', 'REIMBURSED'])
  readonly reimbursementStatus?: string;

  /** 是否参与分期（installmentGroupId 不为空） */
  @IsOptional()
  readonly hasInstallment?: boolean;
}

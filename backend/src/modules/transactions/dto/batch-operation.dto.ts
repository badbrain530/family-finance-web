import { IsNotEmpty, IsArray, IsString, IsOptional, IsIn, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTransactionDto } from './create-transaction.dto';

/**
 * 批量操作类型
 */
export type BatchOperationType = 'delete' | 'classify' | 'create';

/**
 * 批量操作DTO
 * 支持批量删除、批量修改分类、批量创建
 */
export class BatchOperationDto {
  /** 操作类型 */
  @IsNotEmpty({ message: '操作类型不能为空' })
  @IsIn(['delete', 'classify', 'create'], { message: '操作类型必须为 delete/classify/create' })
  readonly operation: BatchOperationType;

  /** 交易ID列表（delete和classify操作需要） */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: '至少选择一条记录' })
  @IsString({ each: true })
  readonly ids?: string[];

  /** 目标分类ID（classify操作需要） */
  @IsOptional()
  @IsString()
  readonly categoryId?: string;

  /** 批量创建的交易列表（create操作需要） */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionDto)
  readonly transactions?: CreateTransactionDto[];
}

/**
 * 批量操作结果
 */
export interface BatchOperationResult {
  successCount: number;
  failedCount: number;
  errors?: { index: number; message: string }[];
}

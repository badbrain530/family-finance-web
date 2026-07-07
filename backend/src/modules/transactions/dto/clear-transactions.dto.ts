import { IsNotEmpty, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 清空全部交易 DTO
 * 仅删除交易，保留账户/分类/预算/设置（决策#3）
 * confirm 必须为 true，否则返回验证错误（VALIDATION_ERROR）
 */
export class ClearTransactionsDto {
  /** 家庭ID（前端经 getCurrentFamily 获取） */
  @IsNotEmpty({ message: '家庭ID不能为空' })
  @IsString()
  readonly familyId: string;

  /** 二次确认标志，必须为 true */
  @IsNotEmpty({ message: '必须确认清除操作' })
  @Type(() => Boolean)
  @IsBoolean()
  readonly confirm: boolean;
}

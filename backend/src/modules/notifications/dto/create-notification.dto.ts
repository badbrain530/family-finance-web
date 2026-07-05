import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 通知类型枚举（与Prisma schema中的NotificationType对应）
 */
export enum NotificationTypeEnum {
  BUDGET_WARNING = 'BUDGET_WARNING',
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  BUDGET_SUCCESS = 'BUDGET_SUCCESS',
  LARGE_EXPENSE = 'LARGE_EXPENSE',
  MONTHLY_REPORT = 'MONTHLY_REPORT',
  FAMILY_MEMBER_JOIN = 'FAMILY_MEMBER_JOIN',
  IMPORT_COMPLETE = 'IMPORT_COMPLETE',
}

/**
 * 创建通知DTO（内部调用，不暴露为API）
 */
export class CreateNotificationDto {
  /** 接收通知的用户ID */
  @IsNotEmpty()
  @IsString()
  readonly userId: string;

  /** 通知类型 */
  @IsNotEmpty()
  @IsEnum(NotificationTypeEnum)
  readonly type: NotificationTypeEnum;

  /** 通知标题 */
  @IsNotEmpty()
  @IsString()
  readonly title: string;

  /** 通知内容 */
  @IsNotEmpty()
  @IsString()
  readonly content: string;

  /** 附加数据（如跳转参数、关联ID等） */
  @IsOptional()
  @IsObject()
  readonly data?: Record<string, any>;
}

/**
 * 查询通知DTO
 */
export class QueryNotificationDto {
  /** 是否只查未读 */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  readonly unreadOnly?: boolean;

  /** 通知类型筛选 */
  @IsOptional()
  @IsEnum(NotificationTypeEnum)
  readonly type?: NotificationTypeEnum;

  /** 页码 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page?: number;

  /** 每页条数 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly pageSize?: number;
}

/**
 * 批量标记已读DTO
 */
export class MarkReadDto {
  /** 通知ID列表（为空表示标记全部已读） */
  @IsOptional()
  @IsString({ each: true })
  readonly ids?: string[];
}

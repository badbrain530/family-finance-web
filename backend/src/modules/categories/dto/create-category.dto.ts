import {
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsInt,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 创建分类DTO
 */
export class CreateCategoryDto {
  /** 分类名称 */
  @IsNotEmpty({ message: '分类名称不能为空' })
  @IsString()
  @MinLength(1, { message: '分类名称至少1个字符' })
  @MaxLength(20, { message: '分类名称最多20个字符' })
  readonly name: string;

  /** 父分类ID（null为一级分类） */
  @IsOptional()
  @IsString()
  readonly parentId?: string | null;

  /** 图标标识 */
  @IsNotEmpty({ message: '图标不能为空' })
  @IsString()
  readonly icon: string;

  /**
   * 颜色 hex值（可空）
   * - 一级分类必填；
   * - 二级分类传 null（或 inheritColor=true）表示「继承父级颜色」，非空表示单独覆盖色。
   */
  @IsOptional()
  @IsString()
  readonly color?: string | null;

  /**
   * 是否继承父级颜色（仅二级分类语义有效）
   * true（或 color 为 null）表示继承，后端统一存 color=null；false 且带 color 表示覆盖。
   * 后端以「color==null 即继承」为唯一判据，此字段作为契约一致性冗余。
   */
  @IsOptional()
  readonly inheritColor?: boolean;

  /** 排序序号（可选，默认0） */
  @IsOptional()
  @IsInt()
  readonly sortOrder?: number;

  /** 家庭ID */
  @IsNotEmpty({ message: '家庭ID不能为空' })
  @IsString()
  readonly familyId: string;
}

/**
 * 更新分类DTO
 */
export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: '分类名称至少1个字符' })
  @MaxLength(20, { message: '分类名称最多20个字符' })
  readonly name?: string;

  @IsOptional()
  @IsString()
  readonly icon?: string;

  @IsOptional()
  @IsString()
  readonly color?: string | null;

  /** 是否继承父级颜色（语义同 CreateCategoryDto，仅作契约冗余） */
  @IsOptional()
  readonly inheritColor?: boolean;

  @IsOptional()
  @IsInt()
  readonly sortOrder?: number;
}

/**
 * 重排序单项
 * 对应前端 ReorderCategoriesRequest.items 的元素结构 { id, sortOrder }
 */
export class ReorderCategoryItemDto {
  /** 分类ID */
  @IsString()
  readonly id: string;

  /** 排序序号（整数） */
  @IsInt()
  readonly sortOrder: number;
}

/**
 * 重排序分类DTO
 * body 同时携带 familyId（与前端 ReorderCategoriesRequest 保持一致，避免 forbidNonWhitelisted 拦截）
 */
export class ReorderCategoriesDto {
  /** 家庭ID */
  @IsString()
  readonly familyId: string;

  /** 排序后的分类项列表（含 id 与 sortOrder） */
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => ReorderCategoryItemDto)
  @ValidateNested({ each: true })
  readonly items: ReorderCategoryItemDto[];
}

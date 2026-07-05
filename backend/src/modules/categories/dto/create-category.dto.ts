import { IsNotEmpty, IsString, MinLength, MaxLength, IsOptional, IsInt } from 'class-validator';

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

  /** 颜色 hex值 */
  @IsNotEmpty({ message: '颜色不能为空' })
  @IsString()
  readonly color: string;

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
  readonly color?: string;

  @IsOptional()
  @IsInt()
  readonly sortOrder?: number;
}

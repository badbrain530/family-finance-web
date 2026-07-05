import { IsNotEmpty, IsString, MinLength, MaxLength, IsOptional, IsUrl } from 'class-validator';

/**
 * 创建家庭DTO
 */
export class CreateFamilyDto {
  /** 家庭名称 */
  @IsNotEmpty({ message: '家庭名称不能为空' })
  @IsString()
  @MinLength(1, { message: '家庭名称至少1个字符' })
  @MaxLength(30, { message: '家庭名称最多30个字符' })
  readonly name: string;

  /** 家庭头像（可选） */
  @IsOptional()
  @IsString()
  readonly avatar?: string;
}

/**
 * 更新家庭信息DTO
 */
export class UpdateFamilyDto {
  /** 家庭名称 */
  @IsOptional()
  @IsString()
  @MinLength(1, { message: '家庭名称至少1个字符' })
  @MaxLength(30, { message: '家庭名称最多30个字符' })
  readonly name?: string;

  /** 家庭头像 */
  @IsOptional()
  @IsString()
  readonly avatar?: string;
}

/**
 * 更新成员角色DTO
 */
export class UpdateMemberRoleDto {
  /** 角色类型 */
  @IsNotEmpty({ message: '角色不能为空' })
  @IsString()
  readonly role: 'admin' | 'member' | 'viewer';
}

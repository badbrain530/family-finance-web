import { IsOptional, IsString, MinLength, MaxLength } from 'class-validator';

/**
 * 更新用户信息DTO
 */
export class UpdateUserDto {
  /** 昵称 */
  @IsOptional()
  @IsString()
  @MinLength(1, { message: '昵称至少1个字符' })
  @MaxLength(20, { message: '昵称最多20个字符' })
  readonly nickname?: string;

  /** 头像URL */
  @IsOptional()
  @IsString()
  readonly avatar?: string;
}

/**
 * 修改密码DTO
 */
export class ChangePasswordDto {
  /** 旧密码 */
  @IsString()
  @MinLength(8, { message: '密码至少8位' })
  readonly oldPassword: string;

  /** 新密码 */
  @IsString()
  @MinLength(8, { message: '密码至少8位' })
  @MaxLength(32, { message: '密码最多32位' })
  readonly newPassword: string;
}

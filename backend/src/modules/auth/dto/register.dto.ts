import { IsOptional, IsString, MinLength, MaxLength, Matches, IsNotEmpty } from 'class-validator';

/**
 * 用户注册请求DTO
 * 支持手机号或邮箱注册（至少提供一种）
 */
export class RegisterDto {
  /** 手机号（与email至少填一项） */
  @IsOptional()
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  readonly phone?: string;

  /** 邮箱（与phone至少填一项） */
  @IsOptional()
  @IsString()
  @Matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: '邮箱格式不正确' })
  readonly email?: string;

  /** 密码（8-32位，需包含字母和数字） */
  @IsNotEmpty({ message: '密码不能为空' })
  @IsString()
  @MinLength(8, { message: '密码至少8位' })
  @MaxLength(32, { message: '密码最多32位' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,32}$/, {
    message: '密码需包含字母和数字',
  })
  readonly password: string;

  /** 昵称 */
  @IsNotEmpty({ message: '昵称不能为空' })
  @IsString()
  @MinLength(1, { message: '昵称至少1个字符' })
  @MaxLength(20, { message: '昵称最多20个字符' })
  readonly nickname: string;
}

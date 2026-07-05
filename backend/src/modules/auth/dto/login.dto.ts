import { IsOptional, IsString, IsNotEmpty, Matches } from 'class-validator';

/**
 * 用户登录请求DTO
 * 支持手机号或邮箱登录
 */
export class LoginDto {
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

  /** 密码 */
  @IsNotEmpty({ message: '密码不能为空' })
  @IsString()
  readonly password: string;
}

import { IsNotEmpty, IsString } from 'class-validator';

/**
 * 刷新Token请求DTO
 * refreshToken 可从请求体或 HttpOnly Cookie 中获取
 */
export class RefreshTokenDto {
  /** 刷新令牌 */
  @IsNotEmpty({ message: 'refreshToken不能为空' })
  @IsString()
  readonly refreshToken: string;
}

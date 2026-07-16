import { IsNotEmpty, IsString, IsOptional, IsIn } from 'class-validator';
import { ApiKeyScope } from '../apikey.service';

/**
 * 生成 API Key 请求体（网页侧，JWT 鉴权）
 */
export class CreateApiKeyDto {
  /** 作用域：readonly 仅允许 get*；readwrite 允许写类工具 */
  @IsIn(['READONLY', 'READWRITE'], { message: 'scope 必须为 READONLY 或 READWRITE' })
  readonly scope: ApiKeyScope;

  /** 用户备注，如「我的龙虾-只读」 */
  @IsOptional()
  @IsString()
  readonly name?: string;
}

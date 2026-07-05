import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JWT 认证守卫
 * 自动跳过标记了 @Public() 的接口
 * 其他接口必须携带有效的 Access Token
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * 判断当前路由是否需要认证
   * @param context 执行上下文
   * @returns true 表示放行（公开接口或已认证），false 表示拒绝
   */
  canActivate(context: ExecutionContext) {
    // 检查是否标记了 @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // 执行JWT验证
    return super.canActivate(context);
  }
}

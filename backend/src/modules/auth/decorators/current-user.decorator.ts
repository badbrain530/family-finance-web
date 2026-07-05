import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * JWT Payload 中携带的用户信息
 */
export interface JwtPayload {
  sub: string;       // userId
  nickname: string;  // 用户昵称
  iat?: number;      // 签发时间
  exp?: number;      // 过期时间
}

/**
 * 当前登录用户信息（从JWT解码后注入到请求对象）
 */
export interface AuthenticatedUser {
  userId: string;
  nickname: string;
}

/**
 * @CurrentUser() 参数装饰器
 * 从请求对象中提取当前登录用户信息
 * 用法：getUser(@CurrentUser() user: AuthenticatedUser)
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): AuthenticatedUser | string => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser = request.user;

    // 如果指定了字段名，则返回对应字段
    if (data && user) {
      return user[data];
    }

    return user;
  },
);

import { SetMetadata } from '@nestjs/common';

/**
 * 公开访问装饰器元数据键
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @Public() 装饰器
 * 标记接口为公开访问，不需要JWT认证
 * 用法：@Public() @Get('login')
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);

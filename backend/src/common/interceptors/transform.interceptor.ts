import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 统一响应格式拦截器
 * 将所有成功响应转换为统一格式：{ code: 0, data: T, message: "success" }
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, any> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // 如果已经是统一格式（含code字段），直接返回
        if (data && typeof data === 'object' && 'code' in data) {
          return data;
        }

        // 转换为统一响应格式
        return {
          code: 0,
          data: data ?? null,
          message: 'success',
        };
      }),
    );
  }
}

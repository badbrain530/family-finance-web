import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * 全局异常过滤器
 * 统一API异常响应格式：{ code, data: null, message, errors? }
 * 将所有异常转换为统一的JSON响应格式
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let code: number;
    let message: string;
    let errors: any[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        code = status;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as any;
        message = resp.message || exception.message;
        code = resp.code || status;
        // class-validator 验证错误
        if (Array.isArray(resp.message)) {
          errors = resp.message.map((msg: string, index: number) => {
            // 尝试从消息中提取字段名
            const fieldMatch = msg.match(/^(\w+)\s/);
            return {
              field: fieldMatch ? fieldMatch[1] : `field_${index}`,
              message: msg,
            };
          });
          message = '请求参数验证失败';
          code = 1001; // 验证错误码
        }
      } else {
        message = exception.message;
        code = status;
      }
    } else if (exception instanceof Error) {
      // 未处理的异常
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 2000; // 内部错误码
      message = process.env.NODE_ENV === 'production'
        ? '服务器内部错误'
        : exception.message;
      this.logger.error(`未处理异常: ${exception.message}`, exception.stack);
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 2000;
      message = '服务器内部错误';
    }

    // 记录错误日志
    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - ${status} - ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (status >= 400) {
      this.logger.warn(
        `[${request.method}] ${request.url} - ${status} - ${message}`,
      );
    }

    // 统一响应格式
    response.status(status).json({
      code,
      data: null,
      message,
      ...(errors ? { errors } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

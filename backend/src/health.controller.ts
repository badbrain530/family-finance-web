import { Controller, Get } from '@nestjs/common';
import { Public } from './modules/auth/decorators/public.decorator';

/**
 * 健康检查控制器
 * 用于Docker健康检查和负载均衡探针
 */
@Controller('health')
export class HealthController {
  /**
   * 健康检查端点
   * @returns 服务状态
   */
  @Public()
  @Get()
  check(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

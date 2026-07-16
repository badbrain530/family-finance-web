import { Module } from '@nestjs/common';
import { ApiKeyService } from './apikey.service';
import { ApiKeyController } from './apikey.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { FamiliesModule } from '../families/families.module';

/**
 * API Key 模块（网页侧：JWT 保护）
 * 提供 Key 的生成 / 列表 / 吊销；MCP 侧鉴权复用本模块的 ApiKeyService。
 */
@Module({
  imports: [PrismaModule, FamiliesModule],
  controllers: [ApiKeyController],
  providers: [ApiKeyService],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}

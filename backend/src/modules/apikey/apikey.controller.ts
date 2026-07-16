import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiKeyService, ApiKeyMasked } from './apikey.service';
import { CreateApiKeyDto } from './dto/create-apikey.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

/**
 * API Key 控制器（网页侧）
 * 路由前缀经全局 api 前缀后为 /api/api-keys，受 JwtAuthGuard 保护。
 *
 * 返回结构：
 * - POST   /api/api-keys        → { id, name, scope, plainKey, maskedKey, createdAt }（明文仅此一次）
 * - GET    /api/api-keys        → ApiKeyMasked[]
 * - DELETE /api/api-keys/:id    → { success }
 */
@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  /**
   * 生成新 API Key
   */
  @Post()
  @HttpCode(201)
  async createKey(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApiKeyDto,
  ) {
    const { plainKey, key } = await this.apiKeyService.createKey(
      user.userId,
      dto.scope,
      dto.name,
    );
    return {
      id: key.id,
      name: key.name,
      scope: key.scope,
      plainKey,
      maskedKey: key.maskedKey,
      createdAt: key.createdAt,
    };
  }

  /**
   * 列出当前用户的全部 Key
   */
  @Get()
  async listKeys(@CurrentUser() user: AuthenticatedUser): Promise<ApiKeyMasked[]> {
    return this.apiKeyService.listKeys(user.userId);
  }

  /**
   * 吊销指定 Key
   */
  @Delete(':id')
  async revokeKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.apiKeyService.revokeKey(user.userId, id);
  }
}

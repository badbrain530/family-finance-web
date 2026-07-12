import { Controller, Post, Get, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { LedgersService } from './ledgers.service';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateLedgerDto } from './dto/create-ledger.dto';

/**
 * 账本控制器
 * 管理家庭共同账本和个人子账本
 */
@Controller('ledgers')
export class LedgersController {
  constructor(private readonly ledgersService: LedgersService) {}

  /**
   * 创建账本
   * POST /api/ledgers
   */
  @Post()
  async createLedger(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLedgerDto,
  ) {
    return this.ledgersService.createLedger(user.userId, dto);
  }

  /**
   * 获取家庭下的账本列表
   * GET /api/ledgers?familyId=xxx
   * 兼容历史前端以 params[familyId] 嵌套传递的形态（部署漂移时旧前端镜像仍发嵌套参数）
   */
  @Get()
  async getLedgers(
    @Query('familyId') familyIdParam: string,
    @Query('params') params: { familyId?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const familyId = familyIdParam ?? params?.familyId;
    return this.ledgersService.getLedgers(familyId, user.userId);
  }

  /**
   * 获取账本详情
   * GET /api/ledgers/:id
   */
  @Get(':id')
  async getLedger(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ledgersService.getLedger(id, user.userId);
  }

  /**
   * 更新账本
   * PUT /api/ledgers/:id
   */
  @Put(':id')
  async updateLedger(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body('name') name: string,
  ) {
    return this.ledgersService.updateLedger(id, user.userId, name);
  }

  /**
   * 删除账本
   * DELETE /api/ledgers/:id
   */
  @Delete(':id')
  async deleteLedger(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ledgersService.deleteLedger(id, user.userId);
  }
}

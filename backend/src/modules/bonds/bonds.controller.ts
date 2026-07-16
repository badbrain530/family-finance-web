import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { BondsService } from './bonds.service';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateBondDto, UpdateBondDto, GenerateBondDto } from './dto/create-bond.dto';

/**
 * 债券控制器（仅 HELD 持有方）
 */
@Controller('bonds')
export class BondsController {
  constructor(private readonly bondsService: BondsService) {}

  /**
   * 债券列表（含完整票息计划）
   * GET /api/bonds?familyId=
   */
  @Get()
  async listBonds(
    @CurrentUser() user: AuthenticatedUser,
    @Query('familyId') familyId: string,
  ) {
    if (!familyId) throw new BadRequestException('familyId 必填');
    return this.bondsService.listBonds(user.userId, familyId);
  }

  /**
   * 创建债券（同时计算完整票息计划）
   * POST /api/bonds
   */
  @Post()
  async createBond(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBondDto,
  ) {
    return this.bondsService.createBond(user.userId, dto);
  }

  /**
   * 债券详情（含票息计划）
   * GET /api/bonds/:id
   */
  @Get(':id')
  async getBond(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bondsService.getBond(id, user.userId);
  }

  /**
   * 更新债券（重算票息计划）
   * PUT /api/bonds/:id
   */
  @Put(':id')
  async updateBond(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBondDto,
  ) {
    return this.bondsService.updateBond(id, user.userId, dto);
  }

  /**
   * 删除债券
   * DELETE /api/bonds/:id
   */
  @Delete(':id')
  async deleteBond(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bondsService.deleteBond(id, user.userId);
  }

  /**
   * 为到期 pending 计划生成票息交易
   * POST /api/bonds/:id/generate
   */
  @Post(':id/generate')
  async generatePayments(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateBondDto,
  ) {
    return this.bondsService.generatePayments(id, user.userId, dto);
  }
}

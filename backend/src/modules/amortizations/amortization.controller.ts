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
import { AmortizationService } from './amortization.service';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import {
  CreateAmortizationDto,
  UpdateAmortizationDto,
  GenerateAmortizationDto,
} from './dto/create-amortization.dto';

/**
 * 待摊/预付控制器
 */
@Controller('amortizations')
export class AmortizationController {
  constructor(private readonly amortizationService: AmortizationService) {}

  /**
   * 待摊/预付列表（含摊销计划）
   * GET /api/amortizations?familyId=
   */
  @Get()
  async listItems(
    @CurrentUser() user: AuthenticatedUser,
    @Query('familyId') familyId: string,
  ) {
    if (!familyId) throw new BadRequestException('familyId 必填');
    return this.amortizationService.listItems(user.userId, familyId);
  }

  /**
   * 创建待摊/预付（同时算全表 + 初始入账 EXPENSE）
   * POST /api/amortizations
   */
  @Post()
  async createItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAmortizationDto,
  ) {
    return this.amortizationService.createItem(user.userId, dto);
  }

  /**
   * 待摊/预付详情（含摊销计划）
   * GET /api/amortizations/:id
   */
  @Get(':id')
  async getItem(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.amortizationService.getItem(id, user.userId);
  }

  /**
   * 更新待摊/预付（重算计划）
   * PUT /api/amortizations/:id
   */
  @Put(':id')
  async updateItem(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAmortizationDto,
  ) {
    return this.amortizationService.updateItem(id, user.userId, dto);
  }

  /**
   * 删除待摊/预付
   * DELETE /api/amortizations/:id
   */
  @Delete(':id')
  async deleteItem(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.amortizationService.deleteItem(id, user.userId);
  }

  /**
   * 为到期 pending 计划生成摊销交易
   * POST /api/amortizations/:id/generate
   */
  @Post(':id/generate')
  async generate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateAmortizationDto,
  ) {
    return this.amortizationService.generate(id, user.userId, dto);
  }
}

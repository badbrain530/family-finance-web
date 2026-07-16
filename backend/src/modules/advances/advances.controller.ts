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
import { AdvancesService } from './advances.service';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import {
  CreateAdvanceDto,
  CollectAdvanceDto,
  UpdateAdvanceDto,
} from './dto/create-advance.dto';

/**
 * 垫付控制器
 */
@Controller('advances')
export class AdvancesController {
  constructor(private readonly advancesService: AdvancesService) {}

  /**
   * 垫付列表（支持按 status 过滤）
   * GET /api/advances?familyId=&status=
   */
  @Get()
  async listAdvances(
    @CurrentUser() user: AuthenticatedUser,
    @Query('familyId') familyId: string,
    @Query('status') status?: string,
  ) {
    if (!familyId) throw new BadRequestException('familyId 必填');
    return this.advancesService.listAdvances(user.userId, familyId, status);
  }

  /**
   * 登记垫付（源 EXPENSE 交易 + AdvanceReceivable）
   * POST /api/advances
   */
  @Post()
  async registerAdvance(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAdvanceDto,
  ) {
    return this.advancesService.registerAdvance(user.userId, dto);
  }

  /**
   * 垫付详情
   * GET /api/advances/:id
   */
  @Get(':id')
  async getAdvance(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.advancesService.getAdvance(id, user.userId);
  }

  /**
   * 更新垫付（债务人/约定日/备注）
   * PUT /api/advances/:id
   */
  @Put(':id')
  async updateAdvance(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAdvanceDto,
  ) {
    return this.advancesService.updateAdvance(id, user.userId, dto);
  }

  /**
   * 删除垫付（仅删除应收登记，源支出保留）
   * DELETE /api/advances/:id
   */
  @Delete(':id')
  async deleteAdvance(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.advancesService.deleteAdvance(id, user.userId);
  }

  /**
   * 收回垫付（生成 INCOME 收款交易 + 更新余额状态）
   * POST /api/advances/:id/collect
   */
  @Post(':id/collect')
  async collect(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CollectAdvanceDto,
  ) {
    return this.advancesService.collect(id, user.userId, dto);
  }
}

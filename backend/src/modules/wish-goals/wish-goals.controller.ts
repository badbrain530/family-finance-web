import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { WishGoalsService } from './wish-goals.service';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateWishGoalDto, UpdateWishGoalDto } from './dto/create-wish-goal.dto';

/**
 * 心愿目标控制器
 * 提供心愿目标CRUD接口
 *
 * 路由前缀：/api/wish-goals
 * 所有接口需要JWT认证
 */
@Controller('wish-goals')
export class WishGoalsController {
  constructor(private readonly wishGoalsService: WishGoalsService) {}

  /**
   * 获取心愿目标列表
   * GET /api/wish-goals?familyId=xxx&includeCompleted=true
   */
  @Get()
  async getWishGoals(
    @CurrentUser() user: AuthenticatedUser,
    @Query('familyId') familyId: string,
    @Query('includeCompleted') includeCompleted?: string,
  ) {
    const include = includeCompleted !== 'false';
    return this.wishGoalsService.getWishGoals(user.userId, familyId, include);
  }

  /**
   * 获取单个心愿目标
   * GET /api/wish-goals/:id
   */
  @Get(':id')
  async getWishGoal(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.wishGoalsService.getWishGoal(user.userId, id);
  }

  /**
   * 创建心愿目标
   * POST /api/wish-goals?familyId=xxx
   * Body: { name, targetAmount, targetDate?, icon?, color? }
   */
  @Post()
  async createWishGoal(
    @CurrentUser() user: AuthenticatedUser,
    @Query('familyId') familyId: string,
    @Body() dto: CreateWishGoalDto,
  ) {
    return this.wishGoalsService.createWishGoal(user.userId, familyId, dto);
  }

  /**
   * 更新心愿目标
   * PUT /api/wish-goals/:id
   */
  @Put(':id')
  async updateWishGoal(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateWishGoalDto,
  ) {
    return this.wishGoalsService.updateWishGoal(user.userId, id, dto);
  }

  /**
   * 删除心愿目标
   * DELETE /api/wish-goals/:id
   */
  @Delete(':id')
  async deleteWishGoal(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.wishGoalsService.deleteWishGoal(user.userId, id);
  }
}

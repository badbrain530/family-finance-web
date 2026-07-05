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
import { BudgetsService } from './budgets.service';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateBudgetDto, UpdateBudgetDto, QueryBudgetDto } from './dto/create-budget.dto';

/**
 * 预算控制器
 * 提供预算CRUD、预算执行进度查询接口
 *
 * 路由前缀：/api/budgets
 * 所有接口需要JWT认证
 */
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  /**
   * 获取预算执行进度
   * GET /api/budgets/summary?familyId=xxx&year=2026&month=7
   *
   * 返回总预算+各分类预算的已用/预算/百分比/剩余
   */
  @Get('summary')
  async getBudgetProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Query('familyId') familyId: string,
    @Query() query: QueryBudgetDto,
  ) {
    return this.budgetsService.getBudgetProgress(
      user.userId,
      familyId,
      query.year,
      query.month,
    );
  }

  /**
   * 获取预算列表
   * GET /api/budgets?familyId=xxx&year=2026&month=7
   */
  @Get()
  async getBudgets(
    @CurrentUser() user: AuthenticatedUser,
    @Query('familyId') familyId: string,
    @Query() query: QueryBudgetDto,
  ) {
    return this.budgetsService.getBudgets(
      user.userId,
      familyId,
      query.year,
      query.month,
    );
  }

  /**
   * 创建预算
   * POST /api/budgets?familyId=xxx
   * Body: { categoryId?, amount, year, month, wishGoalId? }
   */
  @Post()
  async createBudget(
    @CurrentUser() user: AuthenticatedUser,
    @Query('familyId') familyId: string,
    @Body() dto: CreateBudgetDto,
  ) {
    return this.budgetsService.createBudget(user.userId, familyId, dto);
  }

  /**
   * 更新预算
   * PUT /api/budgets/:id
   */
  @Put(':id')
  async updateBudget(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateBudgetDto,
  ) {
    return this.budgetsService.updateBudget(user.userId, id, dto);
  }

  /**
   * 删除预算
   * DELETE /api/budgets/:id
   */
  @Delete(':id')
  async deleteBudget(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.budgetsService.deleteBudget(user.userId, id);
  }
}

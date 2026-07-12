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
import { RecurringService } from './recurring.service';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import {
  CreateRecurringRuleDto,
  UpdateRecurringRuleDto,
  GenerateRecurringDto,
} from './dto/create-recurring-rule.dto';

/**
 * 周期记账控制器
 * 静态路由 /generate 声明在 @Get(':id') 之前
 */
@Controller('recurring')
export class RecurringController {
  constructor(private readonly recurringService: RecurringService) {}

  /**
   * 规则列表
   * GET /api/recurring?familyId=
   */
  @Get()
  async listRules(
    @CurrentUser() user: AuthenticatedUser,
    @Query('familyId') familyId: string,
  ) {
    if (!familyId) throw new BadRequestException('familyId 必填');
    return this.recurringService.listRules(user.userId, familyId);
  }

  /**
   * 手动补生成到期项
   * POST /api/recurring/generate
   */
  @Post('generate')
  async generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateRecurringDto,
  ) {
    return this.recurringService.generate(user.userId, dto);
  }

  /**
   * 创建规则
   * POST /api/recurring
   */
  @Post()
  async createRule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecurringRuleDto,
  ) {
    return this.recurringService.createRule(user.userId, dto);
  }

  /**
   * 规则详情
   * GET /api/recurring/:id
   */
  @Get(':id')
  async getRule(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.recurringService.getRule(user.userId, id);
  }

  /**
   * 更新规则
   * PUT /api/recurring/:id
   */
  @Put(':id')
  async updateRule(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateRecurringRuleDto,
  ) {
    return this.recurringService.updateRule(user.userId, id, dto);
  }

  /**
   * 删除规则
   * DELETE /api/recurring/:id
   */
  @Delete(':id')
  async deleteRule(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.recurringService.deleteRule(user.userId, id);
  }

  /**
   * 单规则立即生成到期项
   * POST /api/recurring/:id/generate
   */
  @Post(':id/generate')
  async generateOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.recurringService.generateOne(user.userId, id);
  }
}

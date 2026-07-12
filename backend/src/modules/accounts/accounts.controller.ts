import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

/**
 * 账户控制器
 * 路由前缀：/api/accounts
 * 所有接口需要 JWT 认证，并遵循 familyId 维度隔离
 */
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  /**
   * 账户列表
   * GET /api/accounts?familyId=
   */
  @Get()
  async getAccounts(
    @CurrentUser() user: AuthenticatedUser,
    @Query('familyId') familyId: string,
  ) {
    if (!familyId) {
      return [];
    }
    return this.accountsService.getAccounts(familyId, user);
  }

  /**
   * 账户详情
   * GET /api/accounts/:id
   */
  @Get(':id')
  async getAccount(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.accountsService.getAccountById(id, user);
  }

  /**
   * 新建账户
   * POST /api/accounts
   */
  @Post()
  async createAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAccountDto,
  ) {
    return this.accountsService.createAccount(user, dto);
  }

  /**
   * 编辑账户
   * PUT /api/accounts/:id
   */
  @Put(':id')
  async updateAccount(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.accountsService.updateAccount(id, user, dto);
  }

  /**
   * 停用 / 启用账户（翻转 isActive）
   * POST /api/accounts/:id/deactivate
   */
  @Post(':id/deactivate')
  async deactivateAccount(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.accountsService.deactivateAccount(id, user);
  }
}

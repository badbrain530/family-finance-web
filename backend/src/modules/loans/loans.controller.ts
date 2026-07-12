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
import { LoansService } from './loans.service';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateLoanDto, UpdateLoanDto, GenerateLoanDto } from './dto/create-loan.dto';

/**
 * 按揭贷款控制器
 */
@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  /**
   * 贷款列表（含完整还款计划）
   * GET /api/loans?familyId=
   */
  @Get()
  async listLoans(
    @CurrentUser() user: AuthenticatedUser,
    @Query('familyId') familyId: string,
  ) {
    if (!familyId) throw new BadRequestException('familyId 必填');
    return this.loansService.listLoans(user.userId, familyId);
  }

  /**
   * 创建贷款（同时计算完整还款计划）
   * POST /api/loans
   */
  @Post()
  async createLoan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLoanDto,
  ) {
    return this.loansService.createLoan(user.userId, dto);
  }

  /**
   * 贷款详情（含还款计划）
   * GET /api/loans/:id
   */
  @Get(':id')
  async getLoan(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.loansService.getLoan(id, user.userId);
  }

  /**
   * 更新贷款（重算还款计划）
   * PUT /api/loans/:id
   */
  @Put(':id')
  async updateLoan(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLoanDto,
  ) {
    return this.loansService.updateLoan(id, user.userId, dto);
  }

  /**
   * 删除贷款
   * DELETE /api/loans/:id
   */
  @Delete(':id')
  async deleteLoan(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.loansService.deleteLoan(id, user.userId);
  }

  /**
   * 为到期 pending 计划生成还款交易
   * POST /api/loans/:id/generate
   */
  @Post(':id/generate')
  async generatePayments(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateLoanDto,
  ) {
    return this.loansService.generatePayments(id, user.userId, dto);
  }
}

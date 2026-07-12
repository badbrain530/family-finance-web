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
import { TransactionsService } from './transactions.service';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateTransactionDto, UpdateTransactionDto } from './dto/create-transaction.dto';
import { QueryTransactionDto } from './dto/query-transaction.dto';
import { BatchOperationDto } from './dto/batch-operation.dto';
import { QuickRecordDto } from './dto/quick-record.dto';
import { ClearTransactionsDto } from './dto/clear-transactions.dto';
import { RefundTransactionDto } from './dto/refund-transaction.dto';
import { MarkReimbursementDto, ConfirmReimbursementDto } from './dto/reimbursement.dto';
import { CreateInstallmentDto } from './dto/create-installment.dto';

/**
 * 交易控制器
 * 提供交易CRUD、分页查询、快捷记账、批量操作接口
 */
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * 交易列表（分页+筛选）
   * GET /api/transactions
   */
  @Get()
  async getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryTransactionDto,
  ) {
    return this.transactionsService.getTransactions(user.userId, query);
  }

  /**
   * 创建交易
   * POST /api/transactions
   */
  @Post()
  async createTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactionsService.createTransaction(user.userId, dto);
  }

  /**
   * 快捷记账（Ctrl+K 自然语言记账）
   * POST /api/transactions/quick
   */
  @Post('quick')
  async quickRecord(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: QuickRecordDto,
  ) {
    return this.transactionsService.quickRecord(user.userId, dto);
  }

  /**
   * 批量操作
   * POST /api/transactions/batch
   */
  @Post('batch')
  async batchOperation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BatchOperationDto,
  ) {
    return this.transactionsService.batchOperation(user.userId, dto);
  }

  /**
   * 清空全部交易（仅删交易，保留账户/分类/预算/设置）
   * POST /api/transactions/clear
   * 注意：路由声明需早于 :id 参数路由，避免被其拦截（NestJS 中静态路径仍安全，此处仅作规范）
   */
  @Post('clear')
  async clearAll(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ClearTransactionsDto,
  ) {
    // confirm 必须为 true，否则视为未确认（VALIDATION_ERROR）
    if (dto.confirm !== true) {
      throw new BadRequestException({
        code: 1001,
        message: '请确认清除操作（confirm 必须为 true）',
      });
    }
    return this.transactionsService.clearAllTransactions(dto.familyId, user.userId);
  }

  /**
   * 分期付款：一次生成 N 笔独立 EXPENSE 交易
   * POST /api/transactions/installment
   * 注意：静态路由必须声明在 @Get(':id') 之前
   */
  @Post('installment')
  async createInstallment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInstallmentDto,
  ) {
    return this.transactionsService.createInstallment(user.userId, dto);
  }

  /**
   * 获取交易详情
   * GET /api/transactions/:id
   */
  @Get(':id')
  async getTransaction(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transactionsService.getTransaction(id, user.userId);
  }

  /**
   * 更新交易
   * PUT /api/transactions/:id
   */
  @Put(':id')
  async updateTransaction(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.updateTransaction(id, user.userId, dto);
  }

  /**
   * 删除交易
   * DELETE /api/transactions/:id
   */
  @Delete(':id')
  async deleteTransaction(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transactionsService.deleteTransaction(id, user.userId);
  }

  /**
   * 退款：为指定支出生成反向 INCOME 交易
   * POST /api/transactions/:id/refund
   */
  @Post(':id/refund')
  async refundTransaction(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RefundTransactionDto,
  ) {
    return this.transactionsService.refund(id, user.userId, dto);
  }

  /**
   * 标记待报销
   * POST /api/transactions/:id/reimbursement/mark
   */
  @Post(':id/reimbursement/mark')
  async markReimbursement(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MarkReimbursementDto,
  ) {
    return this.transactionsService.markReimbursement(id, user.userId, dto);
  }

  /**
   * 取消待报销标记
   * POST /api/transactions/:id/reimbursement/cancel
   */
  @Post(':id/reimbursement/cancel')
  async cancelReimbursement(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transactionsService.cancelReimbursement(id, user.userId);
  }

  /**
   * 确认报销：生成 INCOME 反向交易并置 REIMBURSED
   * POST /api/transactions/:id/reimbursement/confirm
   */
  @Post(':id/reimbursement/confirm')
  async confirmReimbursement(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmReimbursementDto,
  ) {
    return this.transactionsService.confirmReimbursement(id, user.userId, dto);
  }

  /**
   * 撤销快捷记账
   * POST /api/transactions/:id/undo
   */
  @Post(':id/undo')
  async undoQuickRecord(
    @Param('id') id: string,
    @Body('undoToken') undoToken: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transactionsService.undoQuickRecord(undoToken, user.userId);
  }

  /**
   * 纠正交易分类（AI学习反馈）
   * POST /api/transactions/:id/correct
   */
  @Post(':id/correct')
  async correctCategory(
    @Param('id') id: string,
    @Body('categoryId') categoryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transactionsService.correctCategory(id, user.userId, categoryId);
  }
}

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

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgersService } from '../ledgers/ledgers.service';
import { CategoriesService } from '../categories/categories.service';
import { FamiliesService } from '../families/families.service';
import { CreateTransactionDto, UpdateTransactionDto } from './dto/create-transaction.dto';
import { QueryTransactionDto } from './dto/query-transaction.dto';
import { BatchOperationDto, BatchOperationResult } from './dto/batch-operation.dto';
import { QuickRecordDto, ParsedTransaction, QuickRecordResult } from './dto/quick-record.dto';
import { RefundTransactionDto } from './dto/refund-transaction.dto';
import { MarkReimbursementDto, ConfirmReimbursementDto } from './dto/reimbursement.dto';
import { CreateInstallmentDto } from './dto/create-installment.dto';
import { nanoid } from 'nanoid';
import dayjs from 'dayjs';

/** 大额支出阈值（元） */
const LARGE_EXPENSE_THRESHOLD = 1000;

/** 撤销令牌有效期（5分钟，毫秒） */
const UNDO_TOKEN_TTL_MS = 5 * 60 * 1000;

/** 存储撤销令牌的内存Map（MVP阶段，后续可迁移到Redis） */
const undoTokenStore = new Map<string, { transactionId: string; expiresAt: Date }>();

/**
 * 交易服务
 * 核心业务模块：交易CRUD、快捷记账NLP解析、批量操作、事件驱动
 */
@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgersService: LedgersService,
    private readonly categoriesService: CategoriesService,
    private readonly familiesService: FamiliesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ==================== 交易CRUD ====================

  /**
   * 清空家庭全部交易（保留账户/分类/预算/设置，决策#3）
   * 仅删除该家庭下的交易，不触发级联删账户
   * @param familyId 家庭ID
   * @param userId 操作者用户ID（用于家庭隔离校验）
   * @returns 删除数量
   */
  async clearAllTransactions(familyId: string, userId: string): Promise<{ deleted: number }> {
    // 家庭隔离校验：确认操作者属于该家庭
    await this.familiesService.validateFamilyMember(familyId, userId);

    // 按家庭删除：通过账本归属过滤
    const result = await this.prisma.transaction.deleteMany({
      where: { ledger: { familyId } },
    });

    this.logger.log(`清空交易: family=${familyId}, deleted=${result.count}, by=${userId}`);

    // 发出事件，便于前端/WebSocket同步
    this.eventEmitter.emit('transactions.cleared', { familyId, userId, deleted: result.count });

    return { deleted: result.count };
  }

  /**
   * 创建交易
   * @param userId 记账人ID
   * @param dto 交易信息
   * @returns 创建的交易
   */
  async createTransaction(userId: string, dto: CreateTransactionDto) {
    // 验证账本权限
    const ledger = await this.ledgersService.getLedger(dto.ledgerId, userId);

    // 验证分类（如果指定了分类ID）
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new BadRequestException('分类不存在');
      }
      if (category.familyId !== ledger.familyId) {
        throw new BadRequestException('分类不属于该家庭');
      }
    }

    // 判断是否大额支出
    const isLargeExpense = dto.type === 'expense' && dto.amount >= LARGE_EXPENSE_THRESHOLD;

    // 校验账户（若指定）属于该家庭，避免越权关联
    if (dto.accountId) {
      const account = await this.prisma.account.findUnique({
        where: { id: dto.accountId },
        select: { familyId: true },
      });
      if (!account) {
        throw new BadRequestException('账户不存在');
      }
      if (account.familyId !== ledger.familyId) {
        throw new BadRequestException('账户不属于该家庭');
      }
    }

    // 创建交易
    const transaction = await this.prisma.transaction.create({
      data: {
        ledgerId: dto.ledgerId,
        userId,
        categoryId: dto.categoryId || null,
        accountId: dto.accountId || null,
        type: dto.type.toUpperCase() as 'INCOME' | 'EXPENSE' | 'TRANSFER',
        amount: dto.amount,
        date: new Date(dto.date),
        merchant: dto.merchant || null,
        note: dto.note || null,
        source: (dto.source || 'manual').toUpperCase() as 'MANUAL' | 'QUICK_RECORD' | 'IMPORT' | 'VOICE' | 'AGENT',
        importRecordId: dto.importRecordId || null,
        aiConfidence: dto.aiConfidence || null,
        aiCorrected: false,
        isLargeExpense,
        tags: dto.tags || [],
        // ===== 二期扩展字段（均可空，向原交易/反向交易关联） =====
        refundOfId: dto.refundOfId || null,
        reimbursementOfId: dto.reimbursementOfId || null,
        advanceOfId: dto.advanceOfId || null,
        amortizationItemId: dto.amortizationItemId || null,
        installmentGroupId: dto.installmentGroupId || null,
        installmentSeq: dto.installmentSeq ?? null,
        installmentTotal: dto.installmentTotal ?? null,
      },
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
        user: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
    });

    // 同步更新关联账户余额（收入/支出按规则调整；信用卡相反）
    if (dto.accountId) {
      await this.adjustAccountBalance(dto.accountId, transaction.type, Number(transaction.amount), 1);
    }

    // 发出事件：交易创建（WebSocket网关监听后广播给家庭成员）
    this.eventEmitter.emit('transaction.created', {
      transaction,
      ledgerId: dto.ledgerId,
      familyId: ledger.familyId,
      userId,
    });

    // 如果是大额支出，发出预警事件
    if (isLargeExpense) {
      this.eventEmitter.emit('transaction.large_expense', {
        transaction,
        familyId: ledger.familyId,
        userId,
      });
    }

    this.logger.log(`交易创建: ${transaction.id}, type=${dto.type}, amount=${dto.amount}, by=${userId}`);
    return transaction;
  }

  /**
   * 获取交易列表（分页+筛选）
   * @param userId 请求者用户ID
   * @param query 查询条件
   * @returns 分页交易列表
   */
  async getTransactions(userId: string, query: QueryTransactionDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const sortBy = query.sortBy || 'date';
    const sortOrder = query.sortOrder || 'desc';

    // 构建查询条件
    const where: any = {};

    if (query.ledgerId) {
      where.ledgerId = query.ledgerId;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.accountId) {
      where.accountId = query.accountId;
    }

    if (query.type) {
      where.type = query.type.toUpperCase();
    }

    if (query.memberId) {
      where.userId = query.memberId;
    }

    // 日期范围
    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) {
        where.date.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.date.lte = new Date(query.dateTo);
      }
    }

    // 金额范围
    if (query.minAmount !== undefined || query.maxAmount !== undefined) {
      where.amount = {};
      if (query.minAmount !== undefined) {
        where.amount.gte = query.minAmount;
      }
      if (query.maxAmount !== undefined) {
        where.amount.lte = query.maxAmount;
      }
    }

    // 关键词搜索（商户名或备注）
    if (query.keyword) {
      where.OR = [
        { merchant: { contains: query.keyword, mode: 'insensitive' } },
        { note: { contains: query.keyword, mode: 'insensitive' } },
      ];
    }

    // 二期扩展筛选：退款状态 / 报销状态 / 分期
    if (query.refundStatus) {
      where.refundStatus = query.refundStatus.toUpperCase();
    }
    if (query.reimbursementStatus) {
      where.reimbursementStatus = query.reimbursementStatus.toUpperCase();
    }
    if (query.hasInstallment) {
      where.installmentGroupId = { not: null };
    }

    // 如果指定了账本，验证权限
    if (query.ledgerId) {
      await this.ledgersService.getLedger(query.ledgerId, userId);
    }

    // 查询总数
    const total = await this.prisma.transaction.count({ where });

    // 查询分页数据
    const items = await this.prisma.transaction.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
        user: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取交易详情
   * @param transactionId 交易ID
   * @param userId 请求者用户ID
   * @returns 交易详情
   */
  async getTransaction(transactionId: string, userId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
        user: {
          select: { id: true, nickname: true, avatar: true },
        },
        ledger: {
          select: { id: true, name: true, familyId: true },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException('交易不存在');
    }

    // 验证权限
    await this.familiesService.validateFamilyMember(transaction.ledger.familyId, userId);

    return transaction;
  }

  /**
   * 更新交易
   * @param transactionId 交易ID
   * @param userId 操作者用户ID
   * @param dto 更新信息
   * @returns 更新后的交易
   */
  async updateTransaction(transactionId: string, userId: string, dto: UpdateTransactionDto) {
    const transaction = await this.getTransaction(transactionId, userId);

    // 构建更新数据
    const updateData: Record<string, unknown> = {};

    if (dto.categoryId !== undefined) {
      // 如果修改了分类，标记为AI纠正
      if (dto.categoryId !== transaction.categoryId) {
        updateData.categoryId = dto.categoryId || null;
        updateData.aiCorrected = true;
      }
    }
    if (dto.type !== undefined) updateData.type = dto.type.toUpperCase();
    if (dto.amount !== undefined) {
      updateData.amount = dto.amount;
      updateData.isLargeExpense = dto.type === 'expense' && dto.amount >= LARGE_EXPENSE_THRESHOLD;
    }
    if (dto.date !== undefined) updateData.date = new Date(dto.date);
    if (dto.merchant !== undefined) updateData.merchant = dto.merchant || null;
    if (dto.note !== undefined) updateData.note = dto.note || null;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    // 账户ID（账户管理增量）：可设置为新账户、置空（取消关联）
    if (dto.accountId !== undefined) {
      if (dto.accountId) {
        const account = await this.prisma.account.findUnique({
          where: { id: dto.accountId },
          select: { familyId: true },
        });
        if (!account) {
          throw new BadRequestException('账户不存在');
        }
        if (account.familyId !== transaction.ledger.familyId) {
          throw new BadRequestException('账户不属于该家庭');
        }
      }
      updateData.accountId = dto.accountId || null;
    }

    const updated = await this.prisma.transaction.update({
      where: { id: transactionId },
      data: updateData,
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
        user: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
    });

    // 校正关联账户余额：先撤销旧交易影响，再施加更新后影响
    // （若账户/金额/类型未变，两次调用相互抵消，净影响为零，逻辑自洽）
    const origType = transaction.type;
    const origAmount = Number(transaction.amount);
    const origAccountId = transaction.accountId;
    const newType = (dto.type ? dto.type.toUpperCase() : origType) as 'INCOME' | 'EXPENSE' | 'TRANSFER';
    const newAmount = dto.amount !== undefined ? dto.amount : origAmount;
    const newAccountId = dto.accountId !== undefined ? dto.accountId : origAccountId;
    await this.adjustAccountBalance(origAccountId, origType, origAmount, -1);
    await this.adjustAccountBalance(newAccountId, newType, newAmount, 1);

    // 发出事件：交易更新
    this.eventEmitter.emit('transaction.updated', {
      transaction: updated,
      ledgerId: transaction.ledgerId,
      familyId: transaction.ledger.familyId,
      userId,
    });

    return updated;
  }

  /**
   * 删除交易
   * @param transactionId 交易ID
   * @param userId 操作者用户ID
   * @returns 操作结果
   */
  async deleteTransaction(transactionId: string, userId: string): Promise<{ success: boolean }> {
    const transaction = await this.getTransaction(transactionId, userId);

    // 删除时回滚关联账户余额（符号反向）
    await this.adjustAccountBalance(
      transaction.accountId,
      transaction.type,
      Number(transaction.amount),
      -1,
    );

    await this.prisma.transaction.delete({
      where: { id: transactionId },
    });

    // 发出事件：交易删除
    this.eventEmitter.emit('transaction.deleted', {
      transactionId,
      ledgerId: transaction.ledgerId,
      familyId: transaction.ledger.familyId,
      userId,
    });

    return { success: true };
  }

  // ==================== 退款（反向 INCOME 交易） ====================

  /**
   * 退款：为指定支出交易生成一笔反向 INCOME 交易，并回写原交易的累计退款与状态。
   * 校验：仅 EXPENSE 可退；refundedAmount + amount <= 原额。
   * 反向交易复用 createTransaction → 自动账户余额校正 + WS 事件。
   *
   * @param transactionId 原支出交易ID
   * @param userId 操作者用户ID
   * @param dto 退款信息
   * @returns { original, refund }
   */
  async refund(transactionId: string, userId: string, dto: RefundTransactionDto): Promise<{
    original: any;
    refund: any;
  }> {
    // 取原交易（含权限校验：familyId 隔离）
    const original = await this.getTransaction(transactionId, userId);

    if (original.type !== 'EXPENSE') {
      throw new BadRequestException('仅支出交易可退款');
    }

    const originalAmount = Number(original.amount);
    const alreadyRefunded = Number(original.refundedAmount) || 0;
    if (alreadyRefunded + dto.amount > originalAmount + 0.001) {
      throw new BadRequestException(
        `退款金额超出可退余额（原额 ${originalAmount}，已退 ${alreadyRefunded}）`,
      );
    }

    // 退款账户默认取原支出账户
    const refundAccountId = dto.accountId !== undefined ? dto.accountId : original.accountId;

    // 生成反向 INCOME 交易（走 createTransaction 内部逻辑）
    const refundTx = await this.createTransaction(userId, {
      ledgerId: original.ledgerId,
      categoryId: original.categoryId,
      accountId: refundAccountId ?? null,
      type: 'income',
      amount: dto.amount,
      date: dto.date,
      merchant: original.merchant || null,
      note: dto.note || `退款：${original.merchant || original.note || '支出'}`,
      source: 'manual',
      currency: original.currency,
      refundOfId: original.id,
    } as CreateTransactionDto);

    // 回写原交易累计退款与状态（NONE/PARTIAL/FULL）
    const newRefunded = Math.round((alreadyRefunded + dto.amount) * 100) / 100;
    const refundStatus = newRefunded >= originalAmount - 0.001 ? 'FULL' : 'PARTIAL';
    const updated = await this.prisma.transaction.update({
      where: { id: original.id },
      data: { refundedAmount: newRefunded, refundStatus },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        user: { select: { id: true, nickname: true, avatar: true } },
      },
    });

    this.logger.log(
      `退款: original=${original.id}, refund=${refundTx.id}, amount=${dto.amount}, status=${refundStatus}, by=${userId}`,
    );

    return { original: updated, refund: refundTx };
  }

  // ==================== 报销（状态标记 + 反向 INCOME 交易） ====================

  /**
   * 标记待报销：仅设置 reimbursementStatus=PENDING，不生成交易。
   * @returns 更新后的原交易
   */
  async markReimbursement(
    transactionId: string,
    userId: string,
    dto: MarkReimbursementDto,
  ): Promise<any> {
    const original = await this.getTransaction(transactionId, userId);
    if (original.type !== 'EXPENSE') {
      throw new BadRequestException('仅支出交易可标记报销');
    }
    if (original.reimbursementStatus === 'REIMBURSED') {
      throw new BadRequestException('该交易已报销，不可重复标记');
    }

    const baseMeta =
      original.metadata && typeof original.metadata === 'object' && !Array.isArray(original.metadata)
        ? (original.metadata as Record<string, unknown>)
        : {};

    const updated = await this.prisma.transaction.update({
      where: { id: original.id },
      data: {
        reimbursementStatus: 'PENDING',
        // 来源存入 metadata（不新增枚举/列），source=family|company
        metadata: {
          ...baseMeta,
          reimbursementSource: dto.source || 'family',
        },
      },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        user: { select: { id: true, nickname: true, avatar: true } },
      },
    });

    this.eventEmitter.emit('transaction.updated', {
      transaction: updated,
      ledgerId: original.ledgerId,
      familyId: original.ledger.familyId,
      userId,
    });

    this.logger.log(`标记待报销: original=${original.id}, source=${dto.source || 'family'}, by=${userId}`);
    return updated;
  }

  /**
   * 取消待报销标记：PENDING → NONE
   */
  async cancelReimbursement(transactionId: string, userId: string): Promise<any> {
    const original = await this.getTransaction(transactionId, userId);
    if (original.reimbursementStatus !== 'PENDING') {
      throw new BadRequestException('该交易当前不处于待报销状态');
    }

    const updated = await this.prisma.transaction.update({
      where: { id: original.id },
      data: { reimbursementStatus: 'NONE' },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        user: { select: { id: true, nickname: true, avatar: true } },
      },
    });

    this.eventEmitter.emit('transaction.updated', {
      transaction: updated,
      ledgerId: original.ledgerId,
      familyId: original.ledger.familyId,
      userId,
    });

    return updated;
  }

  /**
   * 确认报销：生成 type=INCOME 反向交易（reimbursementOfId=原id），原交易置 REIMBURSED。
   * 报销收入计入总收入，但不冲减支出（与退款语义分离，§7.2）。
   * @returns { original, reimbursement }
   */
  async confirmReimbursement(
    transactionId: string,
    userId: string,
    dto: ConfirmReimbursementDto,
  ): Promise<{ original: any; reimbursement: any }> {
    const original = await this.getTransaction(transactionId, userId);
    if (original.type !== 'EXPENSE') {
      throw new BadRequestException('仅支出交易可报销');
    }
    if (original.reimbursementStatus === 'REIMBURSED') {
      throw new BadRequestException('该交易已报销');
    }

    const source =
      (original.metadata && (original.metadata as any).reimbursementSource) || 'family';
    const reimbursementAccountId =
      dto.accountId !== undefined ? dto.accountId : original.accountId;

    // 生成反向 INCOME 交易（走 createTransaction 内部逻辑）
    const reimbursementTx = await this.createTransaction(userId, {
      ledgerId: original.ledgerId,
      categoryId: original.categoryId,
      accountId: reimbursementAccountId ?? null,
      type: 'income',
      amount: Number(original.amount),
      date: dto.date,
      merchant: original.merchant || null,
      note: dto.note || `报销：${original.merchant || original.note || '支出'}`,
      source: 'manual',
      currency: original.currency,
      reimbursementOfId: original.id,
    } as CreateTransactionDto);

    const baseMeta =
      original.metadata && typeof original.metadata === 'object' && !Array.isArray(original.metadata)
        ? (original.metadata as Record<string, unknown>)
        : {};

    const updated = await this.prisma.transaction.update({
      where: { id: original.id },
      data: {
        reimbursementStatus: 'REIMBURSED',
        metadata: {
          ...baseMeta,
          reimbursementSource: source,
          reimbursementTxId: reimbursementTx.id,
        },
      },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        user: { select: { id: true, nickname: true, avatar: true } },
      },
    });

    this.logger.log(
      `确认报销: original=${original.id}, reimbursement=${reimbursementTx.id}, source=${source}, by=${userId}`,
    );

    return { original: updated, reimbursement: reimbursementTx };
  }

  // ==================== 分期付款（独立 N 笔 EXPENSE） ====================

  /**
   * 分期付款：一次生成 N 笔独立 EXPENSE 交易（同 installmentGroupId，seq=1..N，日期按月递增）。
   * 每笔复用 createTransaction → 自动账户余额校正 + WS 事件。
   *
   * @param userId 操作者用户ID
   * @param dto 分期信息
   * @returns { groupId, transactions }
   */
  async createInstallment(userId: string, dto: CreateInstallmentDto): Promise<{
    groupId: string;
    transactions: any[];
  }> {
    const groupId = nanoid();
    const perAmount = Math.round((dto.totalAmount / dto.periods) * 100) / 100;
    const start = dayjs(dto.startMonth + '-01').startOf('month');

    const transactions: any[] = [];

    for (let seq = 1; seq <= dto.periods; seq++) {
      const isLast = seq === dto.periods;
      // 末期校正：使 N 期总额精确等于 totalAmount（其余各期为 round(total/periods)）
      const amount = isLast
        ? Math.round((dto.totalAmount - perAmount * (dto.periods - 1)) * 100) / 100
        : perAmount;
      const date = start.add(seq - 1, 'month').startOf('month').toDate();
      const tx = await this.createTransaction(userId, {
        ledgerId: dto.ledgerId,
        categoryId: dto.categoryId || null,
        accountId: dto.accountId,
        type: 'expense',
        amount,
        date: date.toISOString(),
        merchant: dto.merchant || null,
        note: dto.note || `第${seq}/${dto.periods}期分期`,
        source: 'manual',
        installmentGroupId: groupId,
        installmentSeq: seq,
        installmentTotal: dto.periods,
      } as CreateTransactionDto);
      transactions.push(tx);
    }

    this.logger.log(
      `分期生成: groupId=${groupId}, periods=${dto.periods}, total=${dto.totalAmount}, by=${userId}`,
    );
    return { groupId, transactions };
  }

  // ==================== 快捷记账（NLP解析） ====================

  /**
   * 快捷记账：自然语言解析 + 自动创建交易
   * MVP阶段使用正则+关键词匹配，不调用LLM
   * @param userId 用户ID
   * @param dto 快捷记账输入
   * @returns 创建的交易 + 置信度 + 撤销令牌
   */
  async quickRecord(userId: string, dto: QuickRecordDto): Promise<QuickRecordResult> {
    // 验证账本权限
    const ledger = await this.ledgersService.getLedger(dto.ledgerId, userId);

    // NLP解析
    const parsed = this.parseNaturalLanguage(dto.input);

    // 匹配分类
    let categoryId: string | null = null;
    let confidence = parsed.confidence;

    const matched = await this.categoriesService.matchCategoryByKeyword(
      ledger.familyId,
      parsed.categoryKeyword,
    );

    if (matched) {
      categoryId = matched.categoryId;
      confidence = Math.min(parsed.confidence, matched.confidence);
    } else {
      // 未匹配到分类，降低置信度
      confidence = parsed.confidence * 0.7;
    }

    // 校验账户（若指定）属于该家庭，避免越权关联
    if (dto.accountId) {
      const account = await this.prisma.account.findUnique({
        where: { id: dto.accountId },
        select: { familyId: true },
      });
      if (!account) {
        throw new BadRequestException('账户不存在');
      }
      if (account.familyId !== ledger.familyId) {
        throw new BadRequestException('账户不属于该家庭');
      }
    }

    // 创建交易
    const transaction = await this.prisma.transaction.create({
      data: {
        ledgerId: dto.ledgerId,
        userId,
        categoryId,
        accountId: dto.accountId || null,
        type: parsed.type.toUpperCase() as 'INCOME' | 'EXPENSE',
        amount: parsed.amount,
        date: parsed.date,
        merchant: parsed.merchant,
        note: parsed.note,
        source: 'QUICK_RECORD',
        aiConfidence: confidence,
        aiCorrected: false,
        isLargeExpense: parsed.type === 'expense' && parsed.amount >= LARGE_EXPENSE_THRESHOLD,
      },
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
      },
    });

    // 同步更新关联账户余额
    if (dto.accountId) {
      await this.adjustAccountBalance(dto.accountId, transaction.type, Number(transaction.amount), 1);
    }

    // 生成撤销令牌
    const undoToken = nanoid();
    undoTokenStore.set(undoToken, {
      transactionId: transaction.id,
      expiresAt: new Date(Date.now() + UNDO_TOKEN_TTL_MS),
    });

    // 发出事件：交易创建
    this.eventEmitter.emit('transaction.created', {
      transaction,
      ledgerId: dto.ledgerId,
      familyId: ledger.familyId,
      userId,
    });

    this.logger.log(`快捷记账: input="${dto.input}", parsed={amount:${parsed.amount}, type:${parsed.type}}, confidence=${confidence}, by=${userId}`);

    return {
      transaction: {
        id: transaction.id,
        ledgerId: transaction.ledgerId,
        type: transaction.type.toLowerCase(),
        amount: Number(transaction.amount),
        date: transaction.date.toISOString(),
        merchant: transaction.merchant,
        note: transaction.note,
        categoryId: transaction.categoryId,
        source: transaction.source.toLowerCase(),
        aiConfidence: transaction.aiConfidence,
        createdAt: transaction.createdAt.toISOString(),
      },
      confidence,
      undoToken,
    };
  }

  /**
   * 撤销快捷记账
   * @param undoToken 撤销令牌
   * @param userId 用户ID
   * @returns 操作结果
   */
  async undoQuickRecord(undoToken: string, userId: string): Promise<{ success: boolean }> {
    const tokenData = undoTokenStore.get(undoToken);

    if (!tokenData) {
      throw new BadRequestException('撤销令牌无效');
    }

    // 检查是否过期
    if (tokenData.expiresAt < new Date()) {
      undoTokenStore.delete(undoToken);
      throw new BadRequestException('撤销令牌已过期');
    }

    // 删除交易
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: tokenData.transactionId },
      include: { ledger: { select: { familyId: true } } },
    });

    if (transaction) {
      // 验证权限
      await this.familiesService.validateFamilyMember(transaction.ledger.familyId, userId);

      // 撤销时回滚关联账户余额（符号反向）
      await this.adjustAccountBalance(
        transaction.accountId,
        transaction.type,
        Number(transaction.amount),
        -1,
      );

      await this.prisma.transaction.delete({
        where: { id: tokenData.transactionId },
      });

      // 发出事件：交易删除
      this.eventEmitter.emit('transaction.deleted', {
        transactionId: transaction.id,
        ledgerId: transaction.ledgerId,
        familyId: transaction.ledger.familyId,
        userId,
      });
    }

    // 清除令牌
    undoTokenStore.delete(undoToken);

    this.logger.log(`快捷记账撤销: transaction=${tokenData.transactionId}, by=${userId}`);

    return { success: true };
  }

  /**
   * 余额修改记录：账户余额被手动修改时，生成一条「余额修改」交易记录。
   *
   * 仅作记录，不调用 adjustAccountBalance —— 余额本身已由 updateAccount 直接设定，
   * 若再调账会导致余额翻倍/归零。用 metadata.balanceAdjustment=true 标记，
   * 前端据此：① 在收入/支出汇总中排除该记录；② 行内展示「余额修改」徽章。
   * 不新增 TransactionSource 枚举值（规避 DB migration），source 复用 MANUAL。
   *
   * @returns 创建的交易；若无可用账本（Transaction.ledgerId 必填）或无实际变动则返回 null
   */
  async recordBalanceAdjustment(params: {
    accountId: string;
    ledgerId: string | null;
    familyId: string;
    userId: string;
    oldBalance: number;
    newBalance: number;
  }): Promise<any | null> {
    const { accountId, ledgerId, familyId, userId, oldBalance, newBalance } = params;

    // 无可用账本则跳过记录（仅更新余额），避免违反 ledgerId 必填约束
    if (!ledgerId) {
      this.logger.warn(`余额修改未生成记录: account=${accountId}, 无可用账本`);
      return null;
    }

    const delta = Math.round((newBalance - oldBalance) * 100) / 100;
    // 余额无实际变化，不生成记录
    if (delta === 0) return null;

    const type: 'INCOME' | 'EXPENSE' = delta > 0 ? 'INCOME' : 'EXPENSE';
    const amount = Math.abs(delta);
    const fmt = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
    const note = `余额修改：${fmt(oldBalance)} → ${fmt(newBalance)}`;

    const transaction = await this.prisma.transaction.create({
      data: {
        ledgerId,
        userId,
        categoryId: null,
        accountId,
        type,
        amount,
        date: new Date(),
        merchant: null,
        note,
        source: 'MANUAL',
        aiConfidence: null,
        aiCorrected: false,
        isLargeExpense: false,
        tags: [],
        metadata: { balanceAdjustment: true, oldBalance, newBalance },
      },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        user: { select: { id: true, nickname: true, avatar: true } },
      },
    });

    // 广播给家庭成员（与 createTransaction 同构，保证前端 WS 实时刷新）
    this.eventEmitter.emit('transaction.created', {
      transaction,
      ledgerId,
      familyId,
      userId,
    });

    this.logger.log(`余额修改记录: account=${accountId}, ${fmt(oldBalance)}→${fmt(newBalance)}, by=${userId}`);
    return transaction;
  }

  /**
   * 交易创建/删除/更新时同步调整关联账户余额。
   *
   * 余额方向规则：
   *  - 非信用卡账户：收入 → 余额增加(+)，支出 → 余额减少(-)
   *  - 信用卡账户（balance 表示欠款）：支出 → 欠款增加(+)，收入/还款 → 欠款减少(-)
   *  - transfer 类型：本次暂不处理（已知限制，避免引入 from/to 双账户复杂度）
   *
   * @param accountId 关联账户ID（空则跳过）
   * @param type 交易类型（数据库大写：INCOME/EXPENSE/TRANSFER）
   * @param amount 金额（number）
   * @param direction 1=创建交易的影响，-1=删除/撤销/更新前的反向回滚
   */
  private async adjustAccountBalance(
    accountId: string | null | undefined,
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER',
    amount: number,
    direction: 1 | -1,
  ) {
    if (!accountId || type === 'TRANSFER' || !amount) return;

    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { type: true, balance: true, creditLimit: true },
    });
    if (!account) return;

    // 计算增量符号：非信用卡 base=收入+1/支出-1；信用卡整体取反
    const base = type === 'INCOME' ? 1 : -1;
    const sign = account.type === 'CREDIT' ? -base : base;
    const current = account.balance != null ? Number(account.balance) : 0;
    const newBalance = current + sign * direction * amount;

    const data: { balance: number; availableCredit?: number } = { balance: newBalance };
    // 信用卡同步重算可用额度 = 授信 - 欠款
    if (account.type === 'CREDIT' && account.creditLimit != null) {
      data.availableCredit = Number(account.creditLimit) - newBalance;
    }
    await this.prisma.account.update({ where: { id: accountId }, data });
  }

  // ==================== 批量操作 ====================

  /**
   * 批量操作
   * @param userId 操作者用户ID
   * @param dto 批量操作信息
   * @returns 操作结果
   */
  async batchOperation(userId: string, dto: BatchOperationDto): Promise<BatchOperationResult> {
    switch (dto.operation) {
      case 'delete':
        return this.batchDelete(userId, dto.ids || []);
      case 'classify':
        return this.batchClassify(userId, dto.ids || [], dto.categoryId || '');
      case 'create':
        return this.batchCreate(userId, dto.transactions || []);
      default:
        throw new BadRequestException('不支持的操作类型');
    }
  }

  /**
   * 批量删除
   */
  private async batchDelete(userId: string, ids: string[]): Promise<BatchOperationResult> {
    let successCount = 0;
    let failedCount = 0;
    const errors: { index: number; message: string }[] = [];

    for (let i = 0; i < ids.length; i++) {
      try {
        await this.deleteTransaction(ids[i], userId);
        successCount++;
      } catch (error) {
        failedCount++;
        errors.push({
          index: i,
          message: error instanceof Error ? error.message : '删除失败',
        });
      }
    }

    return { successCount, failedCount, errors: errors.length > 0 ? errors : undefined };
  }

  /**
   * 批量修改分类
   */
  private async batchClassify(userId: string, ids: string[], categoryId: string): Promise<BatchOperationResult> {
    // 验证分类存在
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new BadRequestException('分类不存在');
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: { index: number; message: string }[] = [];

    for (let i = 0; i < ids.length; i++) {
      try {
        // 验证权限
        const transaction = await this.getTransaction(ids[i], userId);

        await this.prisma.transaction.update({
          where: { id: ids[i] },
          data: {
            categoryId,
            aiCorrected: true,
          },
        });

        // 发出事件
        this.eventEmitter.emit('transaction.updated', {
          transactionId: ids[i],
          ledgerId: transaction.ledgerId,
          familyId: transaction.ledger.familyId,
          userId,
        });

        successCount++;
      } catch (error) {
        failedCount++;
        errors.push({
          index: i,
          message: error instanceof Error ? error.message : '更新失败',
        });
      }
    }

    return { successCount, failedCount, errors: errors.length > 0 ? errors : undefined };
  }

  /**
   * 批量创建
   */
  private async batchCreate(userId: string, transactions: CreateTransactionDto[]): Promise<BatchOperationResult> {
    let successCount = 0;
    let failedCount = 0;
    const errors: { index: number; message: string }[] = [];

    for (let i = 0; i < transactions.length; i++) {
      try {
        await this.createTransaction(userId, transactions[i]);
        successCount++;
      } catch (error) {
        failedCount++;
        errors.push({
          index: i,
          message: error instanceof Error ? error.message : '创建失败',
        });
      }
    }

    return { successCount, failedCount, errors: errors.length > 0 ? errors : undefined };
  }

  // ==================== 分类纠正 ====================

  /**
   * 纠正交易分类（AI学习反馈）
   * @param transactionId 交易ID
   * @param userId 用户ID
   * @param categoryId 纠正后的分类ID
   * @returns 操作结果
   */
  async correctCategory(
    transactionId: string,
    userId: string,
    categoryId: string,
  ): Promise<{ success: boolean }> {
    const transaction = await this.getTransaction(transactionId, userId);

    // 保存分类反馈记录（用于AI学习）
    await this.prisma.classificationFeedback.create({
      data: {
        transactionId,
        userId,
        originalCategoryId: transaction.categoryId,
        correctedCategoryId: categoryId,
        merchant: transaction.merchant || '',
        amount: transaction.amount,
      },
    });

    // 更新交易分类
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        categoryId,
        aiCorrected: true,
      },
    });

    // 发出事件
    this.eventEmitter.emit('transaction.updated', {
      transactionId,
      ledgerId: transaction.ledgerId,
      familyId: transaction.ledger.familyId,
      userId,
    });

    return { success: true };
  }

  // ==================== NLP解析（正则+关键词匹配） ====================

  /**
   * 自然语言解析
   * MVP阶段使用正则+关键词匹配，不调用LLM
   *
   * 解析规则：
   * - 金额提取：正则匹配数字+元/块/¥
   * - 日期提取：今天/昨天/前天/具体日期
   * - 分类匹配：关键词→分类映射表
   * - 类型推断：包含"收入/收到/工资"等→收入，否则→支出
   *
   * @param input 用户输入的自然语言文本
   * @returns 解析结果
   */
  private parseNaturalLanguage(input: string): ParsedTransaction {
    let amount = 0;
    let type: 'income' | 'expense' = 'expense';
    let categoryKeyword = '';
    let note = input.trim();
    let merchant: string | null = null;
    let confidence = 0.8;
    let date = new Date();

    // ===== 1. 金额提取 =====
    // 匹配模式：数字 + 元/块/¥/￥，或 ¥/￥ + 数字
    const amountPatterns = [
      /(\d+(?:\.\d{1,2})?)\s*[元块]/,           // 28元, 28块
      /[¥￥]\s*(\d+(?:\.\d{1,2})?)/,              // ¥28, ￥28
      /(\d+(?:\.\d{1,2})?)\s*[RMB]/i,            // 28RMB
      /花了\s*(\d+(?:\.\d{1,2})?)/,              // 花了28
      /消费\s*(\d+(?:\.\d{1,2})?)/,              // 消费28
      /收到\s*(\d+(?:\.\d{1,2})?)/,              // 收到5000
      /(\d+(?:\.\d{1,2})?)\s*[块元]\s*钱?/,      // 28块钱
    ];

    for (const pattern of amountPatterns) {
      const match = input.match(pattern);
      if (match) {
        amount = parseFloat(match[1]);
        break;
      }
    }

    // 如果没匹配到金额，尝试提取纯数字
    if (amount === 0) {
      const numMatch = input.match(/(\d+(?:\.\d{1,2})?)/);
      if (numMatch) {
        amount = parseFloat(numMatch[1]);
        confidence *= 0.9; // 降低置信度
      }
    }

    // ===== 2. 日期提取 =====
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (input.includes('今天') || input.includes('今日')) {
      date = new Date(today);
    } else if (input.includes('昨天') || input.includes('昨日')) {
      date = new Date(today);
      date.setDate(date.getDate() - 1);
    } else if (input.includes('前天')) {
      date = new Date(today);
      date.setDate(date.getDate() - 2);
    } else if (input.includes('大前天')) {
      date = new Date(today);
      date.setDate(date.getDate() - 3);
    } else {
      // 尝试匹配具体日期格式：MM-DD, MM/DD, YYYY-MM-DD
      const dateMatch = input.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?/);
      if (dateMatch) {
        const month = parseInt(dateMatch[1], 10);
        const day = parseInt(dateMatch[2], 10);
        const year = dateMatch[3] ? parseInt(dateMatch[3], 10) : today.getFullYear();
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          date = new Date(year, month - 1, day);
        }
      }
    }

    // ===== 3. 类型推断 =====
    const incomeKeywords = ['收入', '收到', '工资', '薪水', '奖金', '退款', '报销', '利息', '分红', '兼职', '红包'];
    const isIncome = incomeKeywords.some((kw) => input.includes(kw));
    type = isIncome ? 'income' : 'expense';

    // ===== 4. 分类关键词提取 =====
    // 分类关键词映射表
    const categoryKeywordMap: Record<string, string[]> = {
      '餐饮食品': ['饭', '餐', '食', '吃', '午餐', '晚餐', '早餐', '外卖', '米', '面', '菜', '零食', '饮料', '咖啡', '奶茶', '水果', '宵夜', '汉堡', '火锅', '烧烤', '面条', '饺子'],
      '交通出行': ['车', '地铁', '公交', '打车', '出租', '滴滴', '加油', '停车', '高铁', '火车', '飞机', '机票', '骑行', '单车', '摩的', '快车'],
      '居家生活': ['水电', '燃气', '物业', '房租', '房租房贷', '日用品', '纸巾', '洗衣', '家电', '家具', '装修', '电费', '水费', '燃气费'],
      '文体娱乐': ['电影', '演出', '游戏', '健身', '运动', '旅游', '度假', 'KTV', '酒吧', '唱歌', '游泳', '打球', '门票'],
      '医疗健康': ['医院', '看病', '药', '门诊', '体检', '挂号', '保健', '打针', '检查'],
      '教育培训': ['学费', '培训', '课程', '书', '文具', '学习', '考试', '网课', '辅导'],
      '人情交际': ['红包', '礼金', '请客', '礼物', '份子钱', '聚餐', '聚会', '随礼'],
      '金融保险': ['保险', '投资', '理财', '税费', '基金', '股票', '保费'],
    };

    // 找到第一个匹配的分类关键词
    let matched = false;
    for (const [catName, keywords] of Object.entries(categoryKeywordMap)) {
      if (keywords.some((kw) => input.includes(kw))) {
        categoryKeyword = catName;
        matched = true;
        break;
      }
    }

    // 如果没有匹配到分类关键词，使用输入文本作为关键词
    if (!matched) {
      categoryKeyword = input.replace(/\d+/g, '').replace(/[元块¥￥RMB花了消费收到今天昨天前天]/gi, '').trim();
      if (!categoryKeyword) {
        categoryKeyword = '其他';
      }
      confidence *= 0.6; // 未匹配到分类，降低置信度
    }

    // ===== 5. 备注提取 =====
    // 去除金额和日期信息，保留有意义的文本作为备注
    note = input
      .replace(/(\d+(?:\.\d{1,2})?)\s*[元块RMB]?/gi, '')
      .replace(/[¥￥]/g, '')
      .replace(/今天|今日|昨天|昨日|前天|大前天/g, '')
      .replace(/花了|消费|收到|支出|收入/g, '')
      .trim();

    if (!note) {
      note = input.trim();
    }

    // ===== 6. 商户提取 =====
    // 简单的商户名提取：去掉金额/日期后剩余的文本
    const merchantText = input
      .replace(/(\d+(?:\.\d{1,2})?)\s*[元块RMB]?/gi, '')
      .replace(/[¥￥今天今日昨天昨日前天大前天花了消费收到支出收入]/g, '')
      .trim();
    if (merchantText && merchantText.length <= 20) {
      merchant = merchantText;
    }

    // 判断是否需要用户确认
    const needConfirm = confidence < 0.9 || amount === 0;

    return {
      amount,
      type,
      categoryKeyword,
      note,
      date,
      merchant,
      confidence,
      needConfirm,
    };
  }
}

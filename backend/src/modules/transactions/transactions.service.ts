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
import { nanoid } from 'nanoid';

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
        source: (dto.source || 'manual').toUpperCase() as 'MANUAL' | 'QUICK_RECORD' | 'IMPORT' | 'VOICE',
        importRecordId: dto.importRecordId || null,
        aiConfidence: dto.aiConfidence || null,
        aiCorrected: false,
        isLargeExpense,
        tags: dto.tags || [],
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

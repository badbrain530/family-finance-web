import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { FamiliesService } from '../families/families.service';
import { CreateBudgetDto, UpdateBudgetDto } from './dto/create-budget.dto';
import {
  BudgetProgressResult,
  BudgetAlertType,
  BudgetAlertPayload,
} from './dto/budget-summary.dto';
import dayjs from 'dayjs';

/** 预算预警阈值：80% */
const BUDGET_WARNING_THRESHOLD = 0.8;
/** 预算超支阈值：100% */
const BUDGET_EXCEEDED_THRESHOLD = 1.0;

/**
 * 预算服务
 * 核心功能：预算CRUD、预算执行计算、预算预警
 *
 * 预警机制：
 * - 支出达80% → warning（通知家庭成员）
 * - 支出达100% → exceeded（通知家庭成员）
 * - 通过EventEmitter触发budget.alert事件，NotificationService监听后创建通知
 */
@Injectable()
export class BudgetsService {
  private readonly logger = new Logger(BudgetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly familiesService: FamiliesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ==================== 预算CRUD ====================

  /**
   * 创建预算
   * @param userId 操作者用户ID
   * @param familyId 家庭ID
   * @param dto 预算信息
   * @returns 创建的预算
   */
  async createBudget(userId: string, familyId: string, dto: CreateBudgetDto) {
    // 验证家庭成员权限
    await this.familiesService.validateFamilyMember(familyId, userId);

    // 如果指定了分类，验证分类属于该家庭
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) {
        throw new BadRequestException('分类不存在');
      }
      if (category.familyId !== familyId) {
        throw new BadRequestException('分类不属于该家庭');
      }
    }

    // 如果指定了心愿目标，验证心愿目标属于该家庭
    if (dto.wishGoalId) {
      const wishGoal = await this.prisma.wishGoal.findUnique({
        where: { id: dto.wishGoalId },
      });
      if (!wishGoal) {
        throw new BadRequestException('心愿目标不存在');
      }
      if (wishGoal.familyId !== familyId) {
        throw new BadRequestException('心愿目标不属于该家庭');
      }
    }

    // 检查是否已存在同月同分类的预算（唯一约束）
    const existing = await this.prisma.budget.findFirst({
      where: {
        familyId,
        categoryId: dto.categoryId || null,
        year: dto.year,
        month: dto.month,
      },
    });

    if (existing) {
      throw new ConflictException('该分类本月预算已存在，请使用更新功能');
    }

    const budget = await this.prisma.budget.create({
      data: {
        familyId,
        categoryId: dto.categoryId || null,
        amount: dto.amount,
        period: 'monthly',
        year: dto.year,
        month: dto.month,
        wishGoalId: dto.wishGoalId || null,
      },
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
        wishGoal: {
          select: { id: true, name: true, targetAmount: true, currentAmount: true },
        },
      },
    });

    this.logger.log(
      `预算创建: family=${familyId}, category=${dto.categoryId || 'total'}, ` +
      `amount=${dto.amount}, ${dto.year}-${dto.month}, by=${userId}`,
    );

    return budget;
  }

  /**
   * 获取预算列表
   * @param userId 用户ID
   * @param familyId 家庭ID
   * @param year 年份
   * @param month 月份
   * @returns 预算列表
   */
  async getBudgets(
    userId: string,
    familyId: string,
    year?: number,
    month?: number,
  ) {
    await this.familiesService.validateFamilyMember(familyId, userId);

    // 默认当前年月
    const now = dayjs();
    const queryYear = year || now.year();
    const queryMonth = month || now.month() + 1;

    const budgets = await this.prisma.budget.findMany({
      where: {
        familyId,
        year: queryYear,
        month: queryMonth,
      },
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
        wishGoal: {
          select: { id: true, name: true, targetAmount: true, currentAmount: true },
        },
      },
      orderBy: [{ categoryId: 'asc' }],
    });

    return budgets.map((b) => ({
      ...b,
      amount: Number(b.amount),
    }));
  }

  /**
   * 更新预算
   * @param userId 操作者用户ID
   * @param budgetId 预算ID
   * @param dto 更新信息
   * @returns 更新后的预算
   */
  async updateBudget(userId: string, budgetId: string, dto: UpdateBudgetDto) {
    const budget = await this.prisma.budget.findUnique({
      where: { id: budgetId },
    });

    if (!budget) {
      throw new NotFoundException('预算不存在');
    }

    await this.familiesService.validateFamilyMember(budget.familyId, userId);

    const updateData: Record<string, unknown> = {};
    if (dto.amount !== undefined) {
      updateData.amount = dto.amount;
    }
    if (dto.wishGoalId !== undefined) {
      updateData.wishGoalId = dto.wishGoalId || null;
    }

    const updated = await this.prisma.budget.update({
      where: { id: budgetId },
      data: updateData,
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
        wishGoal: {
          select: { id: true, name: true, targetAmount: true, currentAmount: true },
        },
      },
    });

    this.logger.log(`预算更新: ${budgetId}, by=${userId}`);

    return {
      ...updated,
      amount: Number(updated.amount),
    };
  }

  /**
   * 删除预算
   * @param userId 操作者用户ID
   * @param budgetId 预算ID
   * @returns 操作结果
   */
  async deleteBudget(userId: string, budgetId: string): Promise<{ success: boolean }> {
    const budget = await this.prisma.budget.findUnique({
      where: { id: budgetId },
    });

    if (!budget) {
      throw new NotFoundException('预算不存在');
    }

    await this.familiesService.validateFamilyMember(budget.familyId, userId);

    await this.prisma.budget.delete({
      where: { id: budgetId },
    });

    this.logger.log(`预算删除: ${budgetId}, by=${userId}`);

    return { success: true };
  }

  // ==================== 预算执行计算 ====================

  /**
   * 获取预算执行进度
   * 查询当月所有预算，汇总各分类支出，计算使用百分比
   * @param userId 用户ID
   * @param familyId 家庭ID
   * @param year 年份
   * @param month 月份
   * @returns 预算执行进度
   */
  async getBudgetProgress(
    userId: string,
    familyId: string,
    year?: number,
    month?: number,
  ): Promise<BudgetProgressResult> {
    await this.familiesService.validateFamilyMember(familyId, userId);

    const now = dayjs();
    const queryYear = year || now.year();
    const queryMonth = month || now.month() + 1;

    // 查询该家庭当月所有预算
    const budgets = await this.prisma.budget.findMany({
      where: {
        familyId,
        year: queryYear,
        month: queryMonth,
      },
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
      },
    });

    if (budgets.length === 0) {
      return {
        total: { budget: 0, spent: 0, remaining: 0, percentage: 0 },
        categories: [],
      };
    }

    // 计算当月支出日期范围
    const monthStart = dayjs(`${queryYear}-${String(queryMonth).padStart(2, '0')}-01`).startOf('month').toDate();
    const monthEnd = dayjs(monthStart).endOf('month').toDate();

    // 查询该家庭所有账本的当月支出交易，按分类汇总
    const transactions = await this.prisma.transaction.findMany({
      where: {
        ledger: { familyId },
        type: 'EXPENSE',
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      select: {
        amount: true,
        categoryId: true,
      },
    });

    // 按分类汇总支出
    const categorySpentMap = new Map<string, number>();
    let totalSpent = 0;

    for (const tx of transactions) {
      const catId = tx.categoryId || '__uncategorized__';
      const current = categorySpentMap.get(catId) || 0;
      const newAmount = current + Number(tx.amount);
      categorySpentMap.set(catId, newAmount);
      totalSpent += Number(tx.amount);
    }

    // 构建分类预算进度
    const categoryProgress: BudgetProgressResult['categories'] = [];
    let totalBudget = 0;

    // 只处理有分类的预算（非总预算）
    for (const budget of budgets) {
      if (!budget.categoryId) {
        // 总预算跳过，单独处理
        continue;
      }

      const spent = categorySpentMap.get(budget.categoryId) || 0;
      const budgetAmount = Number(budget.amount);
      const remaining = budgetAmount - spent;
      const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;

      totalBudget += budgetAmount;

      categoryProgress.push({
        categoryId: budget.categoryId,
        categoryName: budget.category?.name || '未分类',
        categoryColor: budget.category?.color || '#A8A8A8',
        budget: budgetAmount,
        spent: Math.round(spent * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        percentage: Math.round(percentage * 100) / 100,
      });
    }

    // 检查是否有总预算记录（categoryId为null）
    const totalBudgetRecord = budgets.find((b) => !b.categoryId);
    if (totalBudgetRecord) {
      totalBudget = Number(totalBudgetRecord.amount);
    }

    // 如果没有分类预算但有总预算，用总预算
    if (totalBudget === 0 && totalBudgetRecord) {
      totalBudget = Number(totalBudgetRecord.amount);
    }

    const totalRemaining = totalBudget - totalSpent;
    const totalPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return {
      total: {
        budget: Math.round(totalBudget * 100) / 100,
        spent: Math.round(totalSpent * 100) / 100,
        remaining: Math.round(totalRemaining * 100) / 100,
        percentage: Math.round(totalPercentage * 100) / 100,
      },
      categories: categoryProgress,
    };
  }

  // ==================== 预算预警 ====================

  /**
   * 检查预算预警并触发事件
   * 在交易创建/更新/删除时调用，检查预算执行情况
   * @param familyId 家庭ID
   * @param categoryId 分类ID
   * @param year 年份
   * @param month 月份
   */
  async checkBudgetAlert(
    familyId: string,
    categoryId: string | null,
    year: number,
    month: number,
  ): Promise<void> {
    // 查询该分类的预算
    const budget = await this.prisma.budget.findFirst({
      where: {
        familyId,
        categoryId: categoryId || null,
        year,
        month,
      },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    if (!budget) {
      // 没有设置该分类的预算，不触发预警
      return;
    }

    const budgetAmount = Number(budget.amount);

    // 查询当月该分类的支出
    const monthStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).startOf('month').toDate();
    const monthEnd = dayjs(monthStart).endOf('month').toDate();

    const spentResult = await this.prisma.transaction.aggregate({
      where: {
        ledger: { familyId },
        type: 'EXPENSE',
        categoryId: categoryId || undefined,
        date: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    });

    const spentAmount = Number(spentResult._sum.amount) || 0;
    const percentage = budgetAmount > 0 ? spentAmount / budgetAmount : 0;

    // 判断预警类型
    let alertType: BudgetAlertType | null = null;
    let message = '';

    if (percentage >= BUDGET_EXCEEDED_THRESHOLD) {
      // 超过100% → exceeded
      alertType = 'exceeded';
      const categoryName = budget.category?.name || '总预算';
      const overAmount = Math.round((spentAmount - budgetAmount) * 100) / 100;
      message = `${categoryName}预算已超支${overAmount}元（已用${Math.round(percentage * 100)}%）`;
    } else if (percentage >= BUDGET_WARNING_THRESHOLD) {
      // 达到80% → warning
      alertType = 'warning';
      const categoryName = budget.category?.name || '总预算';
      message = `${categoryName}预算已使用${Math.round(percentage * 100)}%，请注意控制支出`;
    }

    if (alertType) {
      const payload: BudgetAlertPayload = {
        type: alertType,
        familyId,
        categoryId: categoryId || null,
        categoryName: budget.category?.name || '总预算',
        percentage: Math.round(percentage * 100) / 100,
        budgetAmount,
        spentAmount: Math.round(spentAmount * 100) / 100,
        message,
        year,
        month,
      };

      this.eventEmitter.emit('budget.alert', payload);
      this.logger.warn(
        `预算预警: family=${familyId}, category=${categoryId || 'total'}, ` +
        `type=${alertType}, percentage=${Math.round(percentage * 100)}%`,
      );
    }
  }

  /**
   * 检查总预算预警
   * 汇总所有分类预算的总和，与总支出对比
   * @param familyId 家庭ID
   * @param year 年份
   * @param month 月份
   */
  async checkTotalBudgetAlert(familyId: string, year: number, month: number): Promise<void> {
    // 查询是否有总预算记录
    const totalBudget = await this.prisma.budget.findFirst({
      where: {
        familyId,
        categoryId: null,
        year,
        month,
      },
    });

    if (!totalBudget) {
      return;
    }

    // 查询当月总支出
    const monthStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).startOf('month').toDate();
    const monthEnd = dayjs(monthStart).endOf('month').toDate();

    const spentResult = await this.prisma.transaction.aggregate({
      where: {
        ledger: { familyId },
        type: 'EXPENSE',
        date: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    });

    const budgetAmount = Number(totalBudget.amount);
    const spentAmount = Number(spentResult._sum.amount) || 0;
    const percentage = budgetAmount > 0 ? spentAmount / budgetAmount : 0;

    let alertType: BudgetAlertType | null = null;
    let message = '';

    if (percentage >= BUDGET_EXCEEDED_THRESHOLD) {
      alertType = 'exceeded';
      const overAmount = Math.round((spentAmount - budgetAmount) * 100) / 100;
      message = `家庭总预算已超支${overAmount}元（已用${Math.round(percentage * 100)}%）`;
    } else if (percentage >= BUDGET_WARNING_THRESHOLD) {
      alertType = 'warning';
      message = `家庭总预算已使用${Math.round(percentage * 100)}%，请注意控制支出`;
    }

    if (alertType) {
      const payload: BudgetAlertPayload = {
        type: alertType,
        familyId,
        categoryId: null,
        categoryName: '总预算',
        percentage: Math.round(percentage * 100) / 100,
        budgetAmount,
        spentAmount: Math.round(spentAmount * 100) / 100,
        message,
        year,
        month,
      };

      this.eventEmitter.emit('budget.alert', payload);
      this.logger.warn(
        `总预算预警: family=${familyId}, type=${alertType}, percentage=${Math.round(percentage * 100)}%`,
      );
    }
  }

  // ==================== 事件监听 ====================

  /**
   * 监听交易创建事件，检查预算预警
   * 当有新交易创建时，自动检查对应分类和总预算的执行情况
   * 如果触发预警阈值（80%/100%），通过EventEmitter发出budget.alert事件
   */
  @OnEvent('transaction.created')
  async handleTransactionCreated(payload: {
    transaction: { categoryId: string | null; date: Date | string; ledger?: { familyId: string } };
    ledgerId?: string;
    familyId?: string;
    userId: string;
  }): Promise<void> {
    try {
      const tx = payload.transaction;
      const familyId = payload.familyId || tx.ledger?.familyId;
      if (!familyId) return;

      const txDate = dayjs(tx.date);
      const year = txDate.year();
      const month = txDate.month() + 1;

      // 检查分类预算预警
      if (tx.categoryId) {
        await this.checkBudgetAlert(familyId, tx.categoryId, year, month);
      }

      // 检查总预算预警
      await this.checkTotalBudgetAlert(familyId, year, month);
    } catch (error) {
      this.logger.error(
        `处理交易创建预算检查失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

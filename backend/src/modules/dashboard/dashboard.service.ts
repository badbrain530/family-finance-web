import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FamiliesService } from '../families/families.service';
import {
  calcNetExpense,
  sumRefundAmount,
  sumReimbursedAmount,
  sumAmortizationAmount,
} from '../../common/statistics/net-expense';
import dayjs from 'dayjs';

/** 仪表盘返回的数据结构 */
export interface DashboardData {
  /** 本月KPI汇总 */
  summary: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    previousBalance: number;
    balanceTrend: 'up' | 'down' | 'flat';
  };
  /** 预算执行概览 */
  budgetProgress: {
    totalBudget: number;
    totalSpent: number;
    percentage: number;
    remaining: number;
  };
  /** 最近交易（5条） */
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: number;
    date: string;
    merchant: string | null;
    note: string | null;
    isLargeExpense: boolean;
    categoryId: string | null;
    category: { id: string; name: string; color: string | null; icon: string } | null;
    user: { id: string; nickname: string; avatar: string | null } | null;
  }>;
  /** 收支趋势（6个月） */
  monthlyTrend: Array<{
    month: string;
    income: number;
    expense: number;
  }>;
  /** 分类支出占比 */
  categoryBreakdown: Array<{
    categoryId: string;
    name: string;
    amount: number;
    color: string | null;
    percentage: number;
  }>;
  /** 心愿目标进度 */
  wishGoals: Array<{
    id: string;
    name: string;
    current: number;
    target: number;
    percentage: number;
  }>;
  /** 成员贡献 */
  memberContribution: Array<{
    userId: string;
    nickname: string;
    expense: number;
    count: number;
  }>;
}

/** 最近交易条数 */
const RECENT_TRANSACTION_LIMIT = 5;
/** 月度趋势月份数 */
const TREND_MONTHS = 6;

/**
 * 仪表盘服务
 * 核心功能：聚合家庭财务数据，一次API调用返回所有仪表盘所需数据
 *
 * 聚合内容：
 * 1. 本月KPI（收入/支出/结余/环比）
 * 2. 预算执行概览（总预算/已用/百分比/剩余）
 * 3. 最近交易5条
 * 4. 收支趋势（6个月）
 * 5. 分类支出占比
 * 6. 心愿目标进度
 * 7. 成员贡献（各成员本月支出+记账笔数）
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly familiesService: FamiliesService,
  ) {}

  /**
   * 获取仪表盘聚合数据
   * @param userId 用户ID
   * @param familyId 家庭ID
   * @param year 年份（默认当前年）
   * @param month 月份（默认当前月）
   * @returns 仪表盘完整数据
   */
  async getDashboard(
    userId: string,
    familyId: string,
    year?: number,
    month?: number,
  ): Promise<DashboardData> {
    await this.familiesService.validateFamilyMember(familyId, userId);

    const now = dayjs();
    const queryYear = year || now.year();
    const queryMonth = month || now.month() + 1;

    // 并行查询所有数据
    const [
      summary,
      budgetProgress,
      recentTransactions,
      monthlyTrend,
      categoryBreakdown,
      wishGoals,
      memberContribution,
    ] = await Promise.all([
      this.getSummary(familyId, queryYear, queryMonth),
      this.getBudgetProgress(familyId, queryYear, queryMonth),
      this.getRecentTransactions(familyId),
      this.getMonthlyTrend(familyId, queryYear, queryMonth),
      this.getCategoryBreakdown(familyId, queryYear, queryMonth),
      this.getWishGoals(familyId),
      this.getMemberContribution(familyId, queryYear, queryMonth),
    ]);

    this.logger.log(
      `仪表盘数据聚合: family=${familyId}, ${queryYear}-${queryMonth}, by=${userId}`,
    );

    return {
      summary,
      budgetProgress,
      recentTransactions,
      monthlyTrend,
      categoryBreakdown,
      wishGoals,
      memberContribution,
    };
  }

  // ==================== 私有聚合方法 ====================

  /**
   * 获取本月KPI汇总
   */
  private async getSummary(familyId: string, year: number, month: number) {
    const monthStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).startOf('month').toDate();
    const monthEnd = dayjs(monthStart).endOf('month').toDate();

    // 当月收支
    const incomeResult = await this.prisma.transaction.aggregate({
      where: {
        ledger: { familyId },
        type: 'INCOME',
        date: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    });

    const expenseResult = await this.prisma.transaction.aggregate({
      where: {
        ledger: { familyId },
        type: 'EXPENSE',
        date: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    });

    const totalIncome = Number(incomeResult._sum.amount) || 0;
    // 净支出 = 原支出 − 当期退款/报销/摊销（§7.2 统一口径）
    const refundThisMonth = await sumRefundAmount(this.prisma, familyId, monthStart, monthEnd);
    const reimbursedThisMonth = await sumReimbursedAmount(this.prisma, familyId, monthStart, monthEnd);
    const amortizedThisMonth = await sumAmortizationAmount(this.prisma, familyId, monthStart, monthEnd);
    const totalExpense = calcNetExpense(
      Number(expenseResult._sum.amount) || 0,
      refundThisMonth,
      reimbursedThisMonth,
      amortizedThisMonth,
    );
    const balance = totalIncome - totalExpense;

    // 上月结余
    const prevMonthDate = dayjs(monthStart).subtract(1, 'month');
    const prevMonthStart = prevMonthDate.startOf('month').toDate();
    const prevMonthEnd = prevMonthDate.endOf('month').toDate();

    const prevIncomeResult = await this.prisma.transaction.aggregate({
      where: {
        ledger: { familyId },
        type: 'INCOME',
        date: { gte: prevMonthStart, lte: prevMonthEnd },
      },
      _sum: { amount: true },
    });

    const prevExpenseResult = await this.prisma.transaction.aggregate({
      where: {
        ledger: { familyId },
        type: 'EXPENSE',
        date: { gte: prevMonthStart, lte: prevMonthEnd },
      },
      _sum: { amount: true },
    });

    const prevIncome = Number(prevIncomeResult._sum.amount) || 0;
    // 上月净支出同样扣退/报销/摊销
    const refundPrevMonth = await sumRefundAmount(this.prisma, familyId, prevMonthStart, prevMonthEnd);
    const reimbursedPrevMonth = await sumReimbursedAmount(this.prisma, familyId, prevMonthStart, prevMonthEnd);
    const amortizedPrevMonth = await sumAmortizationAmount(this.prisma, familyId, prevMonthStart, prevMonthEnd);
    const prevExpense = calcNetExpense(
      Number(prevExpenseResult._sum.amount) || 0,
      refundPrevMonth,
      reimbursedPrevMonth,
      amortizedPrevMonth,
    );
    const previousBalance = prevIncome - prevExpense;

    let balanceTrend: 'up' | 'down' | 'flat' = 'flat';
    if (balance > previousBalance) {
      balanceTrend = 'up';
    } else if (balance < previousBalance) {
      balanceTrend = 'down';
    }

    return {
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      balance: Math.round(balance * 100) / 100,
      previousBalance: Math.round(previousBalance * 100) / 100,
      balanceTrend,
    };
  }

  /**
   * 获取预算执行概览
   */
  private async getBudgetProgress(familyId: string, year: number, month: number) {
    // 查询当月所有预算
    const budgets = await this.prisma.budget.findMany({
      where: { familyId, year, month },
      select: { amount: true, categoryId: true },
    });

    if (budgets.length === 0) {
      return { totalBudget: 0, totalSpent: 0, percentage: 0, remaining: 0 };
    }

    // 计算总预算（优先使用总预算记录，否则汇总分类预算）
    const totalBudgetRecord = budgets.find((b) => !b.categoryId);
    const totalBudget = totalBudgetRecord
      ? Number(totalBudgetRecord.amount)
      : budgets.reduce((sum, b) => sum + Number(b.amount), 0);

    // 查询当月总支出
    const monthStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).startOf('month').toDate();
    const monthEnd = dayjs(monthStart).endOf('month').toDate();

    const expenseResult = await this.prisma.transaction.aggregate({
      where: {
        ledger: { familyId },
        type: 'EXPENSE',
        date: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    });

    // 预算消耗同样采用净支出口径（扣退/报销/摊销）
    const refund = await sumRefundAmount(this.prisma, familyId, monthStart, monthEnd);
    const reimbursed = await sumReimbursedAmount(this.prisma, familyId, monthStart, monthEnd);
    const amortized = await sumAmortizationAmount(this.prisma, familyId, monthStart, monthEnd);
    const totalSpent = calcNetExpense(
      Number(expenseResult._sum.amount) || 0,
      refund,
      reimbursed,
      amortized,
    );
    const remaining = totalBudget - totalSpent;
    const percentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    return {
      totalBudget: Math.round(totalBudget * 100) / 100,
      totalSpent: Math.round(totalSpent * 100) / 100,
      percentage: Math.round(percentage * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
    };
  }

  /**
   * 获取最近交易
   */
  private async getRecentTransactions(familyId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        ledger: { familyId },
      },
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
        user: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
      orderBy: { date: 'desc' },
      take: RECENT_TRANSACTION_LIMIT,
    });

    return transactions.map((tx) => ({
      id: tx.id,
      type: tx.type.toLowerCase(),
      amount: Number(tx.amount),
      date: tx.date.toISOString(),
      merchant: tx.merchant,
      note: tx.note,
      isLargeExpense: tx.isLargeExpense,
      categoryId: tx.categoryId,
      category: tx.category
        ? {
            id: tx.category.id,
            name: tx.category.name,
            color: tx.category.color,
            icon: tx.category.icon,
          }
        : null,
      user: tx.user
        ? {
            id: tx.user.id,
            nickname: tx.user.nickname,
            avatar: tx.user.avatar,
          }
        : null,
    }));
  }

  /**
   * 获取收支趋势（6个月）
   */
  private async getMonthlyTrend(familyId: string, year: number, month: number) {
    const trend: Array<{ month: string; income: number; expense: number }> = [];

    // 从5个月前开始，到当前月，共6个月
    for (let i = TREND_MONTHS - 1; i >= 0; i--) {
      const targetDate = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).subtract(i, 'month');
      const monthStart = targetDate.startOf('month').toDate();
      const monthEnd = targetDate.endOf('month').toDate();
      const monthLabel = `${targetDate.month() + 1}月`;

      const incomeResult = await this.prisma.transaction.aggregate({
        where: {
          ledger: { familyId },
          type: 'INCOME',
          date: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      });

      const expenseResult = await this.prisma.transaction.aggregate({
        where: {
          ledger: { familyId },
          type: 'EXPENSE',
          date: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      });

      // 收支趋势的支出同样采用净口径（扣退/报销/摊销）
      const refundForMonth = await sumRefundAmount(this.prisma, familyId, monthStart, monthEnd);
      const reimbursedForMonth = await sumReimbursedAmount(this.prisma, familyId, monthStart, monthEnd);
      const amortizedForMonth = await sumAmortizationAmount(this.prisma, familyId, monthStart, monthEnd);
      const netExpense = calcNetExpense(
        Number(expenseResult._sum.amount) || 0,
        refundForMonth,
        reimbursedForMonth,
        amortizedForMonth,
      );

      trend.push({
        month: monthLabel,
        income: Math.round((Number(incomeResult._sum.amount) || 0) * 100) / 100,
        expense: Math.round(netExpense * 100) / 100,
      });
    }

    return trend;
  }

  /**
   * 获取分类支出占比
   */
  private async getCategoryBreakdown(familyId: string, year: number, month: number) {
    const monthStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).startOf('month').toDate();
    const monthEnd = dayjs(monthStart).endOf('month').toDate();

    // 查询当月所有支出交易（含分类信息）
    const transactions = await this.prisma.transaction.findMany({
      where: {
        ledger: { familyId },
        type: 'EXPENSE',
        date: { gte: monthStart, lte: monthEnd },
      },
      select: {
        amount: true,
        categoryId: true,
        category: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    // 按分类汇总
    const categoryMap = new Map<
      string,
      { categoryId: string; name: string; color: string | null; amount: number }
    >();

    let totalExpense = 0;

    for (const tx of transactions) {
      const catId = tx.categoryId || '__uncategorized__';
      const catName = tx.category?.name || '未分类';
      const catColor = tx.category?.color || '#A8A8A8';
      const amount = Number(tx.amount);

      const existing = categoryMap.get(catId);
      if (existing) {
        existing.amount += amount;
      } else {
        categoryMap.set(catId, {
          categoryId: tx.categoryId || catId,
          name: catName,
          color: catColor,
          amount,
        });
      }
      totalExpense += amount;
    }

    // 净支出口径：按分类扣减当期退款（退款交易继承原支出分类）
    const refunds = await this.prisma.transaction.findMany({
      where: {
        ledger: { familyId },
        type: 'INCOME',
        refundOfId: { not: null },
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { amount: true, categoryId: true },
    });
    for (const r of refunds) {
      const catId = r.categoryId || '__uncategorized__';
      const existing = categoryMap.get(catId);
      if (existing) {
        existing.amount -= Number(r.amount);
      } else {
        // 退款分类在支出中无对应项时，以该分类计入（负向），保证汇总自洽
        categoryMap.set(catId, {
          categoryId: r.categoryId || catId,
          name: '未分类',
          color: '#A8A8A8',
          amount: -Number(r.amount),
        });
      }
      totalExpense -= Number(r.amount);
    }

    // 转换为数组并计算百分比
    const breakdown = Array.from(categoryMap.values())
      .map((c) => ({
        categoryId: c.categoryId,
        name: c.name,
        amount: Math.round(c.amount * 100) / 100,
        color: c.color,
        percentage: totalExpense > 0 ? Math.round((c.amount / totalExpense) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return breakdown;
  }

  /**
   * 获取心愿目标进度
   */
  private async getWishGoals(familyId: string) {
    const wishGoals = await this.prisma.wishGoal.findMany({
      where: { familyId, isCompleted: false },
      orderBy: { createdAt: 'desc' },
      take: 3, // 仪表盘只显示前3个
    });

    return wishGoals.map((g) => {
      const target = Number(g.targetAmount);
      const current = Number(g.currentAmount);
      const percentage = target > 0 ? (current / target) * 100 : 0;

      return {
        id: g.id,
        name: g.name,
        current: Math.round(current * 100) / 100,
        target: Math.round(target * 100) / 100,
        percentage: Math.round(percentage * 100) / 100,
      };
    });
  }

  /**
   * 获取成员贡献
   */
  private async getMemberContribution(familyId: string, year: number, month: number) {
    const monthStart = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).startOf('month').toDate();
    const monthEnd = dayjs(monthStart).endOf('month').toDate();

    // 查询当月所有交易（含用户信息）
    const transactions = await this.prisma.transaction.findMany({
      where: {
        ledger: { familyId },
        date: { gte: monthStart, lte: monthEnd },
      },
      select: {
        userId: true,
        type: true,
        amount: true,
        user: {
          select: { id: true, nickname: true },
        },
      },
    });

    // 按用户汇总
    const memberMap = new Map<
      string,
      { userId: string; nickname: string; expense: number; count: number }
    >();

    for (const tx of transactions) {
      const userId = tx.userId;
      const nickname = tx.user?.nickname || '未知用户';
      const amount = Number(tx.amount);

      const existing = memberMap.get(userId);
      if (existing) {
        if (tx.type === 'EXPENSE') {
          existing.expense += amount;
        }
        existing.count += 1;
      } else {
        memberMap.set(userId, {
          userId,
          nickname,
          expense: tx.type === 'EXPENSE' ? amount : 0,
          count: 1,
        });
      }
    }

    // 净支出：按成员扣减其发起的退款（退款交易 user 同原交易记账人）
    const refunds = await this.prisma.transaction.findMany({
      where: {
        ledger: { familyId },
        type: 'INCOME',
        refundOfId: { not: null },
        date: { gte: monthStart, lte: monthEnd },
      },
      select: { amount: true, userId: true, user: { select: { nickname: true } } },
    });
    for (const r of refunds) {
      const existing = memberMap.get(r.userId);
      if (existing) {
        existing.expense -= Number(r.amount);
      }
    }

    // 转换为数组并按支出排序
    return Array.from(memberMap.values())
      .map((m) => ({
        userId: m.userId,
        nickname: m.nickname,
        expense: Math.round(m.expense * 100) / 100,
        count: m.count,
      }))
      .sort((a, b) => b.expense - a.expense);
  }
}

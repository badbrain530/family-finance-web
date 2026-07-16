/**
 * AI 财务洞察月报 / 聚合服务（去 LLM 版）
 *
 * 本服务只保留「纯数据聚合 + 异常检测」能力，已彻底移除通义千问等 LLM 调用
 * （P0-05）。结论生成职责转移到用户侧 QClaw 智能体（其本地 LLM 基于本服务返回的
 * 结构化 JSON 自行生成可读结论）。
 *
 * 对外公开方法（供 MCP 工具复用）：
 * - aggregateSummary(familyId, start, end)：任意时间区间结构化汇总
 * - getCategoryBreakdown(...) / detectAnomalies(...)（原私有，现公开，供 P1 工具复用）
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import {
  calcNetExpense,
  sumRefundAmount,
  sumReimbursedAmount,
  sumAmortizationAmount,
} from '../../common/statistics/net-expense';

/** 大额支出阈值（元） */
const LARGE_EXPENSE_THRESHOLD = 1000;

/** 异常增长比例阈值（环比增长超过50%） */
const ANOMALY_GROWTH_THRESHOLD = 0.5;

/** 异常频率阈值（某分类交易次数超过月均3倍） */
const ANOMALY_FREQUENCY_MULTIPLIER = 3;

/** 结构化汇总结果（不含任何 LLM 文案） */
export interface SummaryResult {
  totalIncome: number;
  /** 净支出（原额 − 退款 − 报销 − 摊销） */
  totalExpense: number;
  balance: number;
  categoryBreakdown: CategoryBreakdownItem[];
  anomalies: AnomalyItem[];
  period: { start: string; end: string };
}

export interface CategoryBreakdownItem {
  categoryId: string | null;
  categoryName: string;
  amount: number;
  percentage: number;
  previousMonthAmount: number | null;
  trend: 'up' | 'down' | 'flat';
  transactionCount: number;
}

export interface AnomalyItem {
  type: 'large_single' | 'category_spike' | 'total_spike';
  description: string;
  amount: number;
  categoryId: string | null;
  date: string;
}

@Injectable()
export class AiReportService {
  private readonly logger = new Logger(AiReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 生成月度财务洞察报告（网页月报）
   * 仅做真实聚合；conclusion（advice）置空，由 QClaw 侧生成。
   */
  async generateMonthlyReport(familyId: string, year: number, month: number) {
    this.logger.log(`开始生成月报: familyId=${familyId}, ${year}-${month}`);

    // 1. 聚合当月交易数据
    const { transactions, totalIncome, totalExpense } = await this.aggregateMonthlyData(
      familyId,
      year,
      month,
    );

    // 2. 获取上月数据（用于环比）
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const { totalExpense: prevExpense, totalIncome: prevIncome } =
      await this.aggregateMonthlyData(familyId, prevYear, prevMonth);

    const balance = totalIncome - totalExpense;
    const prevBalance = prevIncome - prevExpense;

    // 3. 分类支出排名
    const categoryBreakdown = await this.getCategoryBreakdown(
      familyId,
      year,
      month,
      prevYear,
      prevMonth,
    );

    // 4. 异常检测
    const anomalies = this.detectAnomalies(transactions, categoryBreakdown, prevExpense);

    // 5. 结论置空（P0-05：结论生成已转移至用户侧 QClaw 本地 LLM）
    const advice: any[] = [];

    // 6. 保存月报到数据库（upsert）
    const report = await this.prisma.monthlyReport.upsert({
      where: {
        familyId_year_month: { familyId, year, month },
      },
      update: {
        totalIncome,
        totalExpense,
        balance,
        previousMonthBalance: prevBalance,
        categoryBreakdown: categoryBreakdown as any,
        anomalies: anomalies as any,
        advice: advice as any,
        generatedAt: new Date(),
      },
      create: {
        familyId,
        year,
        month,
        totalIncome,
        totalExpense,
        balance,
        previousMonthBalance: prevBalance,
        categoryBreakdown: categoryBreakdown as any,
        anomalies: anomalies as any,
        advice: advice as any,
      },
    });

    // 7. 触发 report.ready 事件（WebSocket 广播）
    this.eventEmitter.emit('report.ready', {
      reportId: report.id,
      familyId,
      year,
      month,
    });

    this.logger.log(
      `月报生成完成: reportId=${report.id}, income=${totalIncome}, expense=${totalExpense}, ` +
        `balance=${balance}, anomalies=${anomalies.length}`,
    );

    return report;
  }

  // ==================== 公开聚合方法（供 MCP 工具复用） ====================

  /**
   * 任意时间区间的财务汇总（MCP getSummary 核心）。
   * 通过 ledger.familyId 隔离，保证仅统计该家庭数据。
   * @returns 结构化 JSON（无 LLM 文案），结论交由 QClaw 本地生成
   */
  async aggregateSummary(
    familyId: string,
    start: Date,
    end: Date,
  ): Promise<SummaryResult> {
    const ledgers = await this.prisma.ledger.findMany({
      where: { familyId },
      select: { id: true },
    });
    const ledgerIds = ledgers.map((l) => l.id);

    if (ledgerIds.length === 0) {
      return {
        totalIncome: 0,
        totalExpense: 0,
        balance: 0,
        categoryBreakdown: [],
        anomalies: [],
        period: { start: start.toISOString(), end: end.toISOString() },
      };
    }

    const transactions = await this.prisma.transaction.findMany({
      where: { ledgerId: { in: ledgerIds }, date: { gte: start, lt: end } },
      include: { category: { select: { id: true, name: true, color: true } } },
    });

    let totalIncome = 0;
    let grossExpense = 0;
    for (const tx of transactions) {
      const amount = Number(tx.amount);
      if (tx.type === 'INCOME') totalIncome += amount;
      else if (tx.type === 'EXPENSE') grossExpense += amount;
    }

    // 净支出统一口径（§7.2）
    const refundAmount = await sumRefundAmount(this.prisma, familyId, start, end);
    const reimbursedAmount = await sumReimbursedAmount(this.prisma, familyId, start, end);
    const amortizedAmount = await sumAmortizationAmount(this.prisma, familyId, start, end);
    const totalExpense = calcNetExpense(
      grossExpense,
      refundAmount,
      reimbursedAmount,
      amortizedAmount,
    );
    const balance = Math.round((totalIncome - totalExpense) * 100) / 100;

    // 分类明细（净口径，扣当期退款）
    const categoryMap = new Map<string, { name: string; amount: number; count: number }>();
    for (const tx of transactions) {
      if (tx.type !== 'EXPENSE') continue;
      const categoryId = tx.categoryId || 'uncategorized';
      const categoryName = tx.category?.name || '未分类';
      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, { name: categoryName, amount: 0, count: 0 });
      }
      const cat = categoryMap.get(categoryId)!;
      cat.amount += Number(tx.amount);
      cat.count += 1;
    }

    // 当期退款冲减对应分类
    const refunds = await this.prisma.transaction.findMany({
      where: {
        ledger: { familyId },
        type: 'INCOME',
        refundOfId: { not: null },
        date: { gte: start, lt: end },
      },
      select: { amount: true, categoryId: true },
    });
    for (const r of refunds) {
      const categoryId = r.categoryId || 'uncategorized';
      const cat = categoryMap.get(categoryId);
      if (cat) cat.amount -= Number(r.amount);
    }

    const totalExpenseForPct = Array.from(categoryMap.values()).reduce(
      (sum, cat) => sum + cat.amount,
      0,
    );
    const categoryBreakdown: CategoryBreakdownItem[] = Array.from(
      categoryMap.entries(),
    )
      .map(([categoryId, data]) => ({
        categoryId: categoryId === 'uncategorized' ? null : categoryId,
        categoryName: data.name,
        amount: Math.round(data.amount * 100) / 100,
        percentage:
          totalExpenseForPct > 0
            ? Math.round((data.amount / totalExpenseForPct) * 10000) / 100
            : 0,
        previousMonthAmount: null,
        trend: 'flat' as const,
        transactionCount: data.count,
      }))
      .sort((a, b) => b.amount - a.amount);

    const anomalies = this.detectAnomalies(transactions, categoryBreakdown, 0);

    return {
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense,
      balance,
      categoryBreakdown,
      anomalies,
      period: { start: start.toISOString(), end: end.toISOString() },
    };
  }

  /**
   * 获取分类支出明细（公开，供 P1 getMonthlyStats 复用）
   */
  async getCategoryBreakdown(
    familyId: string,
    year: number,
    month: number,
    prevYear: number,
    prevMonth: number,
  ): Promise<CategoryBreakdownItem[]> {
    const { transactions } = await this.aggregateMonthlyData(familyId, year, month);

    // 按分类分组统计
    const categoryMap = new Map<string, { name: string; amount: number; count: number }>();

    for (const tx of transactions) {
      if (tx.type !== 'EXPENSE') continue;

      const categoryId = tx.categoryId || 'uncategorized';
      const categoryName = tx.category?.name || '未分类';

      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, { name: categoryName, amount: 0, count: 0 });
      }

      const cat = categoryMap.get(categoryId)!;
      cat.amount += Number(tx.amount);
      cat.count += 1;
    }

    // 获取上月分类支出
    const { transactions: prevTransactions } = await this.aggregateMonthlyData(
      familyId,
      prevYear,
      prevMonth,
    );

    const prevCategoryMap = new Map<string, number>();
    for (const tx of prevTransactions) {
      if (tx.type !== 'EXPENSE') continue;
      const categoryId = tx.categoryId || 'uncategorized';
      prevCategoryMap.set(
        categoryId,
        (prevCategoryMap.get(categoryId) || 0) + Number(tx.amount),
      );
    }

    // 净口径：扣除当期退款（按分类）
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);
    const refunds = await this.prisma.transaction.findMany({
      where: {
        ledger: { familyId },
        type: 'INCOME',
        refundOfId: { not: null },
        date: { gte: startDate, lt: endDate },
      },
      select: { amount: true, categoryId: true },
    });
    for (const r of refunds) {
      const categoryId = r.categoryId || 'uncategorized';
      const cat = categoryMap.get(categoryId);
      if (cat) {
        cat.amount -= Number(r.amount);
      }
    }

    // 计算总支出（用于百分比）
    const totalExpense = Array.from(categoryMap.values()).reduce(
      (sum, cat) => sum + cat.amount,
      0,
    );

    // 构建分类明细
    const breakdown = Array.from(categoryMap.entries()).map(([categoryId, data]) => {
      const prevAmount = prevCategoryMap.get(categoryId) || null;
      let trend: 'up' | 'down' | 'flat' = 'flat';

      if (prevAmount !== null && prevAmount > 0) {
        const changeRatio = (data.amount - prevAmount) / prevAmount;
        if (changeRatio > 0.1) trend = 'up';
        else if (changeRatio < -0.1) trend = 'down';
      }

      return {
        categoryId: categoryId === 'uncategorized' ? null : categoryId,
        categoryName: data.name,
        amount: Math.round(data.amount * 100) / 100,
        percentage: totalExpense > 0 ? Math.round((data.amount / totalExpense) * 10000) / 100 : 0,
        previousMonthAmount: prevAmount !== null ? Math.round(prevAmount * 100) / 100 : null,
        trend,
        transactionCount: data.count,
      };
    });

    // 按金额降序排列
    breakdown.sort((a, b) => b.amount - a.amount);

    return breakdown;
  }

  /**
   * 异常检测（公开，供 P1 getAnomalies 复用）
   * 1. 大额单笔支出
   * 2. 分类支出异常增长（环比增长超过50%）
   * 3. 总支出环比异常增长
   * @param prevTotalExpense 上一周期总支出；传 0 时跳过总支出环比检测
   */
  detectAnomalies(
    transactions: any[],
    categoryBreakdown: CategoryBreakdownItem[],
    prevTotalExpense: number,
  ): AnomalyItem[] {
    const anomalies: AnomalyItem[] = [];

    // 1. 大额单笔支出
    for (const tx of transactions) {
      if (tx.type === 'EXPENSE' && Number(tx.amount) >= LARGE_EXPENSE_THRESHOLD) {
        anomalies.push({
          type: 'large_single',
          description: `大额支出: ${tx.category?.name || '未分类'} - ${tx.merchant || tx.note || '未知'}`,
          amount: Number(tx.amount),
          categoryId: tx.categoryId || null,
          date: tx.date.toISOString(),
        });
      }
    }

    // 2. 分类支出异常增长
    for (const cat of categoryBreakdown) {
      if (cat.previousMonthAmount !== null && cat.previousMonthAmount > 0) {
        const growthRate = (cat.amount - cat.previousMonthAmount) / cat.previousMonthAmount;
        if (growthRate >= ANOMALY_GROWTH_THRESHOLD) {
          anomalies.push({
            type: 'category_spike',
            description: `${cat.categoryName}支出环比增长${Math.round(growthRate * 100)}%`,
            amount: cat.amount,
            categoryId: cat.categoryId,
            date: new Date().toISOString(),
          });
        }
      }
    }

    // 3. 总支出环比异常增长
    if (prevTotalExpense > 0) {
      const currentTotal = categoryBreakdown.reduce((sum, c) => sum + c.amount, 0);
      const totalGrowth = (currentTotal - prevTotalExpense) / prevTotalExpense;
      if (totalGrowth >= ANOMALY_GROWTH_THRESHOLD) {
        anomalies.push({
          type: 'total_spike',
          description: `总支出环比增长${Math.round(totalGrowth * 100)}%`,
          amount: currentTotal,
          categoryId: null,
          date: new Date().toISOString(),
        });
      }
    }

    return anomalies;
  }

  // ==================== 内部方法 ====================

  /**
   * 聚合月度交易数据（私有，供 generateMonthlyReport / getCategoryBreakdown 复用）
   */
  private async aggregateMonthlyData(
    familyId: string,
    year: number,
    month: number,
  ): Promise<{
    transactions: any[];
    totalIncome: number;
    totalExpense: number;
  }> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1); // 下个月1日（不包含）

    const ledgers = await this.prisma.ledger.findMany({
      where: { familyId },
      select: { id: true },
    });

    const ledgerIds = ledgers.map((l) => l.id);

    if (ledgerIds.length === 0) {
      return { transactions: [], totalIncome: 0, totalExpense: 0 };
    }

    const transactions = await this.prisma.transaction.findMany({
      where: {
        ledgerId: { in: ledgerIds },
        date: { gte: startDate, lt: endDate },
      },
      include: {
        category: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    let totalIncome = 0;
    let totalExpense = 0;

    for (const tx of transactions) {
      const amount = Number(tx.amount);
      if (tx.type === 'INCOME') {
        totalIncome += amount;
      } else if (tx.type === 'EXPENSE') {
        totalExpense += amount;
      }
    }

    const refundAmount = await sumRefundAmount(this.prisma, familyId, startDate, endDate);
    const reimbursedAmount = await sumReimbursedAmount(this.prisma, familyId, startDate, endDate);
    const amortizedAmount = await sumAmortizationAmount(this.prisma, familyId, startDate, endDate);
    totalExpense = calcNetExpense(totalExpense, refundAmount, reimbursedAmount, amortizedAmount);

    return { transactions, totalIncome, totalExpense };
  }
}

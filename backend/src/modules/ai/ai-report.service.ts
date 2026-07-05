/**
 * AI财务洞察月报生成服务
 *
 * 工作流程：
 * 1. 统计数据聚合（总收入、总支出、结余、分类支出排名、环比变化）
 * 2. 异常检测（大额支出预警、异常增长分类）
 * 3. AI洞察生成（调用LLM生成3条可执行建议）
 * 4. 保存MonthlyReport到数据库
 * 5. 触发report.ready WebSocket事件
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { QwenProvider } from './providers/qwen.provider';

/** 大额支出阈值（元） */
const LARGE_EXPENSE_THRESHOLD = 1000;

/** 异常增长比例阈值（环比增长超过50%） */
const ANOMALY_GROWTH_THRESHOLD = 0.5;

/** 异常频率阈值（某分类交易次数超过月均3倍） */
const ANOMALY_FREQUENCY_MULTIPLIER = 3;

@Injectable()
export class AiReportService {
  private readonly logger = new Logger(AiReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmProvider: QwenProvider,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 生成月度财务洞察报告
   *
   * @param familyId 家庭ID
   * @param year 年份
   * @param month 月份（1-12）
   * @returns 生成的月报
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

    // 5. AI生成可执行建议
    const advice = await this.generateAdvice({
      totalIncome,
      totalExpense,
      balance,
      prevBalance,
      prevExpense,
      categoryBreakdown,
      anomalies,
    });

    // 6. 保存月报到数据库（upsert：如果已存在则更新）
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

    // 7. 触发report.ready事件（WebSocket广播）
    this.eventEmitter.emit('report.ready', {
      reportId: report.id,
      familyId,
      year,
      month,
    });

    this.logger.log(
      `月报生成完成: reportId=${report.id}, income=${totalIncome}, expense=${totalExpense}, ` +
      `balance=${balance}, anomalies=${anomalies.length}, advice=${advice.length}`,
    );

    return report;
  }

  // ==================== 内部方法 ====================

  /**
   * 聚合月度交易数据
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
    // 计算月份起止日期
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1); // 下个月1日（不包含）

    // 获取该家庭所有账本
    const ledgers = await this.prisma.ledger.findMany({
      where: { familyId },
      select: { id: true },
    });

    const ledgerIds = ledgers.map((l) => l.id);

    if (ledgerIds.length === 0) {
      return { transactions: [], totalIncome: 0, totalExpense: 0 };
    }

    // 查询当月所有交易
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

    // 统计收入和支出
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

    return { transactions, totalIncome, totalExpense };
  }

  /**
   * 获取分类支出明细
   */
  private async getCategoryBreakdown(
    familyId: string,
    year: number,
    month: number,
    prevYear: number,
    prevMonth: number,
  ): Promise<any[]> {
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
   * 异常检测
   * 1. 大额单笔支出
   * 2. 分类支出异常增长（环比增长超过50%）
   * 3. 异常频率（某分类交易次数过多）
   */
  private detectAnomalies(
    transactions: any[],
    categoryBreakdown: any[],
    prevTotalExpense: number,
  ): any[] {
    const anomalies: any[] = [];

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
          type: 'category_spike',
          description: `总支出环比增长${Math.round(totalGrowth * 100)}%`,
          amount: currentTotal,
          categoryId: null,
          date: new Date().toISOString(),
        });
      }
    }

    return anomalies;
  }

  /**
   * AI生成可执行建议
   * 调用通义千问，基于当月消费数据生成3条建议
   */
  private async generateAdvice(data: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    prevBalance: number;
    prevExpense: number;
    categoryBreakdown: any[];
    anomalies: any[];
  }): Promise<any[]> {
    // 构建prompt
    const topCategories = data.categoryBreakdown.slice(0, 5).map((c) =>
      `${c.categoryName}: ${c.amount}元 (${c.percentage}%)`,
    ).join('\n');

    const anomalyDescriptions = data.anomalies.map((a) => `- ${a.description}`).join('\n');

    const prompt = `作为家庭财务顾问，请根据以下月度财务数据，给出3条具体可执行的理财建议。

月度财务概览：
- 总收入：${data.totalIncome}元
- 总支出：${data.totalExpense}元
- 结余：${data.balance}元
- 上月结余：${data.prevBalance}元

支出前5分类：
${topCategories}

异常情况：
${anomalyDescriptions || '无异常'}

请严格按照以下JSON数组格式返回，每条建议包含category、title、content三个字段：
[
  {"category": "saving", "title": "建议标题", "content": "详细建议内容"},
  {"category": "budget", "title": "建议标题", "content": "详细建议内容"},
  {"category": "anomaly", "title": "建议标题", "content": "详细建议内容"}
]

category可选值: saving（节流建议）、budget（预算建议）、goal（目标建议）、anomaly（异常提醒）
只返回JSON，不要其他内容。`;

    try {
      const response = await this.llmProvider.chat(
        [
          {
            role: 'system',
            content: '你是一位专业的家庭财务顾问，擅长分析家庭收支数据并给出实用的理财建议。你的建议需要具体、可执行、有数据支撑。',
          },
          { role: 'user', content: prompt },
        ],
        { temperature: 0.7, maxTokens: 800 },
      );

      // 解析JSON响应
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const adviceList = JSON.parse(jsonMatch[0]);
        return adviceList.map((item: any, index: number) => ({
          id: `advice_${Date.now()}_${index}`,
          category: item.category || 'saving',
          title: item.title || '财务建议',
          content: item.content || '',
          actionType: null,
          actionUrl: null,
          isHelpful: null,
        }));
      }
    } catch (err) {
      this.logger.warn(
        `AI建议生成失败，使用默认建议: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // LLM失败时的默认建议
    const savingsRate = data.totalIncome > 0
      ? Math.round((data.balance / data.totalIncome) * 100)
      : 0;

    return [
      {
        id: `advice_default_1`,
        category: 'saving',
        title: '储蓄率分析',
        content: `本月储蓄率为${savingsRate}%，${savingsRate >= 20 ? '保持了良好的储蓄习惯' : '建议提高储蓄率至20%以上'}。结余${data.balance}元可用于应急基金或投资理财。`,
        actionType: null,
        actionUrl: null,
        isHelpful: null,
      },
      {
        id: `advice_default_2`,
        category: 'budget',
        title: '支出结构优化',
        content: data.categoryBreakdown.length > 0
          ? `最大支出分类为"${data.categoryBreakdown[0].categoryName}"，占比${data.categoryBreakdown[0].percentage}%。建议关注该分类的消费情况，设定合理的预算上限。`
          : '建议为各支出分类设定月度预算，定期跟踪执行情况。',
        actionType: 'adjust_budget',
        actionUrl: '/budget',
        isHelpful: null,
      },
      {
        id: `advice_default_3`,
        category: 'anomaly',
        title: '异常支出提醒',
        content: data.anomalies.length > 0
          ? `本月检测到${data.anomalies.length}项异常支出，建议核查：${data.anomalies.slice(0, 2).map((a) => a.description).join('；')}。`
          : '本月未检测到异常支出，消费情况正常。',
        actionType: null,
        actionUrl: null,
        isHelpful: null,
      },
    ];
  }
}

/**
 * 报告相关类型定义
 */

/** 分类支出明细 */
export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  previousMonthAmount: number | null;
  trend: 'up' | 'down' | 'flat';
}

/** 异常支出项 */
export interface AnomalyItem {
  type: 'large_single' | 'category_spike' | 'unusual_frequency';
  description: string;
  amount: number;
  categoryId: string | null;
  date: string;
}

/** AI建议项 */
export interface AdviceItem {
  id: string;
  category: 'saving' | 'budget' | 'goal' | 'anomaly';
  title: string;
  content: string;
  actionType: string | null;
  actionUrl: string | null;
  isHelpful: boolean | null;
}

/** 国标对标比较 */
export interface BenchmarkComparison {
  category: string;
  userPercentage: number;
  benchmarkPercentage: number;
  difference: number;
}

/** 月度报告 */
export interface MonthlyReport {
  id: string;
  familyId: string;
  year: number;
  month: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  previousMonthBalance: number | null;
  categoryBreakdown: CategoryBreakdown[];
  anomalies: AnomalyItem[];
  advice: AdviceItem[];
  benchmarkComparison: BenchmarkComparison | null;
  generatedAt: string;
  readBy: string[];
}

/** 仪表盘聚合数据 */
export interface DashboardData {
  summary: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    previousBalance: number;
    balanceTrend: 'up' | 'down' | 'flat';
  };
  budgetProgress: {
    totalBudget: number;
    totalSpent: number;
    percentage: number;
    remaining: number;
  };
  recentTransactions: import('./transaction').Transaction[];
  monthlyTrend: Array<{ month: string; income: number; expense: number }>;
  categoryBreakdown: Array<{
    categoryId: string;
    name: string;
    amount: number;
    color: string;
  }>;
  wishGoals: Array<{
    id: string;
    name: string;
    current: number;
    target: number;
    percentage: number;
  }>;
  memberContribution: Array<{
    userId: string;
    nickname: string;
    expense: number;
    count: number;
  }>;
}

/** 建议反馈请求 */
export interface ReportFeedbackRequest {
  adviceId: string;
  isHelpful: boolean;
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Sparkles,
  Lightbulb,
  AlertTriangle,
  Target,
  ThumbsUp,
  ThumbsDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Download,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart } from '@/components/charts/BarChart';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { cn, formatCurrency, formatPercentage, formatDate, getCurrentYearMonth } from '@/lib/utils';
import { MONTH_NAMES } from '@/lib/constants';
import type { MonthlyReport, AdviceItem } from '@/types/report';

/**
 * AI洞察月报页面
 * 月份选择 + 3个KPI（含环比）+ AI建议列表 + 收支分类对比图
 */

// 建议分类图标配置
const ADVICE_ICON: Record<AdviceItem['category'], typeof Lightbulb> = {
  saving: Wallet,
  budget: Target,
  goal: Sparkles,
  anomaly: AlertTriangle,
};

const ADVICE_COLOR: Record<AdviceItem['category'], string> = {
  saving: 'text-primary',
  budget: 'text-budget-warning',
  goal: 'text-income',
  anomaly: 'text-expense',
};

const ADVICE_BG: Record<AdviceItem['category'], string> = {
  saving: 'bg-primary/10',
  budget: 'bg-budget-warning/10',
  goal: 'bg-income/10',
  anomaly: 'bg-expense/10',
};

export function MonthlyReportPage() {
  const isMobile = useIsMobile();
  const { year, month } = getCurrentYearMonth();
  const [displayYear, setDisplayYear] = useState(year);
  const [displayMonth, setDisplayMonth] = useState(month);
  const [adviceFeedback, setAdviceFeedback] = useState<Record<string, boolean | null>>({});

  // TanStack Query 获取月报数据
  const { data: reportData, isLoading } = useQuery({
    queryKey: ['monthly-report', displayYear, displayMonth],
    queryFn: async () => {
      // TODO: 接入真实 API
      return null;
    },
  });

  // 暂用常量（后续移除）
  const mockReport: MonthlyReport = {
    id: 'r1',
    familyId: 'f1',
    year: 2026,
    month: 7,
    totalIncome: 18500,
    totalExpense: 12380.5,
    balance: 6119.5,
    previousMonthBalance: 5200,
    categoryBreakdown: [
      { categoryId: 'c1', categoryName: '食品烟酒', amount: 4200, percentage: 33.9, previousMonthAmount: 3800, trend: 'up' },
      { categoryId: 'c2', categoryName: '居住', amount: 3500, percentage: 28.3, previousMonthAmount: 3500, trend: 'flat' },
      { categoryId: 'c3', categoryName: '交通通信', amount: 1800, percentage: 14.5, previousMonthAmount: 1500, trend: 'up' },
      { categoryId: 'c4', categoryName: '教育文化', amount: 1500, percentage: 12.1, previousMonthAmount: 2000, trend: 'down' },
      { categoryId: 'c5', categoryName: '生活用品', amount: 980, percentage: 7.9, previousMonthAmount: 700, trend: 'up' },
      { categoryId: 'c6', categoryName: '其他', amount: 400.5, percentage: 3.3, previousMonthAmount: 300, trend: 'up' },
    ],
    anomalies: [
      { type: 'large_single', description: '7月3日 华润万家消费 ¥1,280', amount: 1280, categoryId: 'c1', date: '2026-07-03' },
      { type: 'category_spike', description: '交通通信支出环比增长20%', amount: 300, categoryId: 'c3', date: '2026-07-04' },
    ],
    advice: [
      { id: 'a1', category: 'saving', title: '食品烟酒支出偏高', content: '本月食品烟酒支出4200元...', actionType: 'adjust_budget', actionUrl: '/budget', isHelpful: null },
      { id: 'a2', category: 'budget', title: '交通通信即将超预算', content: '交通通信已用90%预算...', actionType: 'view_budget', actionUrl: '/budget', isHelpful: null },
      { id: 'a3', category: 'goal', title: '日本旅行基金进度良好', content: '你的日本旅行基金已存56.7%...', actionType: 'view_goal', actionUrl: '/budget', isHelpful: null },
      { id: 'a4', category: 'anomaly', title: '检测到大额支出', content: '7月3日华润万家消费1280元...', actionType: null, actionUrl: null, isHelpful: null },
    ],
    benchmarkComparison: null,
    generatedAt: '2026-07-04T08:00:00Z',
    readBy: [],
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  const report = reportData || mockReport;

  // 环比计算
  const balanceChange = report.balance - (report.previousMonthBalance || 0);
  const balanceChangePercent = report.previousMonthBalance
    ? ((balanceChange / report.previousMonthBalance) * 100)
    : 0;
  const isBalanceUp = balanceChange > 0;

  // KPI卡片
  const kpiCards = [
    {
      label: '本月收入',
      value: report.totalIncome,
      icon: ArrowUpRight,
      color: 'text-income',
      bgColor: 'bg-income/10',
      change: null,
    },
    {
      label: '本月支出',
      value: report.totalExpense,
      icon: ArrowDownRight,
      color: 'text-expense',
      bgColor: 'bg-expense/10',
      change: null,
    },
    {
      label: '本月结余',
      value: report.balance,
      icon: Wallet,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      change: {
        value: Math.abs(balanceChange),
        percent: Math.abs(balanceChangePercent),
        isUp: isBalanceUp,
      },
    },
  ];

  // 月份切换
  const handlePrevMonth = () => {
    if (displayMonth === 1) { setDisplayMonth(12); setDisplayYear(displayYear - 1); }
    else setDisplayMonth(displayMonth - 1);
  };
  const handleNextMonth = () => {
    if (displayMonth === 12) { setDisplayMonth(1); setDisplayYear(displayYear + 1); }
    else setDisplayMonth(displayMonth + 1);
  };

  // 建议反馈
  const handleFeedback = (adviceId: string, isHelpful: boolean) => {
    setAdviceFeedback((prev) => ({ ...prev, [adviceId]: isHelpful }));
  };

  return (
    <div className="page-container">
      {/* 标题栏 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">AI财务洞察月报</h1>
          <p className="text-text-secondary mt-1">
            {displayYear}年{MONTH_NAMES[displayMonth - 1]}财务报告 · AI生成于 {formatDate(report.generatedAt, 'MM-dd HH:mm')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm font-medium text-text-primary min-w-20 text-center">
            {displayYear}年{MONTH_NAMES[displayMonth - 1]}
          </span>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight size={16} />
          </Button>
          <Button variant="outline" size="sm">
            <Download size={14} />
            导出
          </Button>
        </div>
      </div>

      {/* KPI 卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-text-secondary">{kpi.label}</span>
                <div className={`w-10 h-10 rounded-lg ${kpi.bgColor} flex items-center justify-center`}>
                  <Icon size={20} className={kpi.color} />
                </div>
              </div>
              <p className={`text-2xl font-bold ${kpi.color} tabular-nums`}>
                {formatCurrency(kpi.value)}
              </p>
              {kpi.change && (
                <div className="flex items-center gap-1 mt-2">
                  {kpi.change.isUp ? (
                    <TrendingUp size={12} className="text-income" />
                  ) : (
                    <TrendingDown size={12} className="text-expense" />
                  )}
                  <span className={cn(
                    'text-xs font-medium',
                    kpi.change.isUp ? 'text-income' : 'text-expense',
                  )}>
                    环比{kpi.change.isUp ? '增加' : '减少'} {formatCurrency(kpi.change.value)} ({formatPercentage(kpi.change.percent)})
                  </span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* 收支分类对比图 */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">收支分类对比</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart
            xLabels={report.categoryBreakdown.map((c) => c.categoryName)}
            series={[
              {
                name: '本月',
                data: report.categoryBreakdown.map((c) => c.amount),
                color: '#00C896',
              },
              {
                name: '上月',
                data: report.categoryBreakdown.map((c) => c.previousMonthAmount || 0),
                color: '#94A3B8',
              },
            ]}
            height={isMobile ? 280 : 320}
            showLegend
          />
        </CardContent>
      </Card>

      {/* AI建议列表 */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles size={18} className="text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">AI智能建议</CardTitle>
              <p className="text-xs text-text-tertiary mt-0.5">基于本月数据分析生成</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {report.advice.map((advice) => {
            const Icon = ADVICE_ICON[advice.category];
            const feedback = adviceFeedback[advice.id];
            return (
              <div
                key={advice.id}
                className="flex gap-3 p-4 rounded-xl border border-border hover:border-primary-200 transition-colors"
              >
                {/* 图标 */}
                <div className={`w-9 h-9 rounded-lg ${ADVICE_BG[advice.category]} flex items-center justify-center shrink-0`}>
                  <Icon size={18} className={ADVICE_COLOR[advice.category]} />
                </div>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-text-primary">{advice.title}</h4>
                    {advice.actionUrl && (
                      <Button variant="ghost" size="sm" className="text-primary text-xs shrink-0" asChild>
                        <a href={advice.actionUrl}>查看</a>
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">{advice.content}</p>

                  {/* 反馈按钮 */}
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs text-text-tertiary">这条建议有帮助吗？</span>
                    <button
                      onClick={() => handleFeedback(advice.id, true)}
                      className={cn(
                        'p-1 rounded transition-colors',
                        feedback === true ? 'text-income bg-income/10' : 'text-text-tertiary hover:text-income',
                      )}
                    >
                      <ThumbsUp size={14} />
                    </button>
                    <button
                      onClick={() => handleFeedback(advice.id, false)}
                      className={cn(
                        'p-1 rounded transition-colors',
                        feedback === false ? 'text-expense bg-expense/10' : 'text-text-tertiary hover:text-expense',
                      )}
                    >
                      <ThumbsDown size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 异常支出提醒 */}
      {report.anomalies.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-expense/10 flex items-center justify-center">
                <AlertTriangle size={18} className="text-expense" />
              </div>
              <CardTitle className="text-base">异常支出提醒</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.anomalies.map((anomaly, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 rounded-lg bg-expense/5 border border-expense/10"
              >
                <div className="w-2 h-2 rounded-full bg-expense shrink-0" />
                <span className="text-sm text-text-primary flex-1">{anomaly.description}</span>
                <span className="text-sm font-semibold text-expense tabular-nums">
                  {formatCurrency(anomaly.amount)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

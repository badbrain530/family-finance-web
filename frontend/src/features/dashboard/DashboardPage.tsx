import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Target,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import {
  formatCurrency,
  formatPercentage,
  formatDate,
  getCurrentYearMonth,
} from '@/lib/utils';
import { MONTH_NAMES } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LineChart } from '@/components/charts/LineChart';
import { PieChart } from '@/components/charts/PieChart';
import { AmountText } from '@/components/common/AmountText';
import { CategoryTag } from '@/components/common/CategoryTag';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { getDashboardData } from '@/services/dashboard.service';
import { getCurrentFamily } from '@/services/family.service';
import type { Transaction } from '@/types/transaction';

/**
 * 仪表盘主页面（W-02, P0）
 * 包含：4个KPI卡片、收支趋势折线图、分类支出饼图、
 * 最近交易列表、预算执行概览
 */

export function DashboardPage() {
  const { user } = useAuthStore();
  const { setQuickRecordOpen } = useUIStore();
  const isMobile = useIsMobile();
  const { year, month } = getCurrentYearMonth();
  const [displayYear, setDisplayYear] = useState(year);
  const [displayMonth, setDisplayMonth] = useState(month);

  // 当前家庭（正确的 familyId 来源，与 AccountsPage 保持一致：通过 getCurrentFamily() 取 family.id）
  // 注意：本项目真正的 familyId 来自「当前家庭」，不是 user.id。
  // 上一轮误用 user.id 当 familyId，导致后端 validateFamilyMember(familyId, userId) 校验失败 → 404/403。
  const familyQuery = useQuery({
    queryKey: ['currentFamily'],
    queryFn: getCurrentFamily,
  });
  const familyId = familyQuery.data?.id ?? '';

  // 使用 TanStack Query 获取仪表盘数据
  const { data: dashboardData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', familyId, displayYear, displayMonth],
    queryFn: () => getDashboardData(familyId, displayYear, displayMonth),
    enabled: !!familyId,
  });

  // 安全归一化：后端可能返回「非空但字段不全」的对象（例如 monthlyTrend / categoryBreakdown 为 undefined）。
  // 若只对整体做 `dashboardData || DEFAULTS` 兜底，partial 对象会因「整体为 truthy」而绕过兜底，
  // 导致 `data.xxx.map` 抛 TypeError。这里对每个子字段单独兜底，保证 data 始终结构完整、可安全渲染。
  // 注意：data 与 kpiCards 必须定义在所有提前 return 之前，以保证 Hook 调用顺序稳定（修复 React #310）。
  const data = {
    summary: dashboardData?.summary ?? {
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      previousBalance: 0,
      balanceTrend: 'flat' as const,
    },
    budgetProgress: dashboardData?.budgetProgress ?? {
      totalBudget: 0,
      totalSpent: 0,
      percentage: 0,
      remaining: 0,
    },
    recentTransactions: dashboardData?.recentTransactions ?? [],
    monthlyTrend: dashboardData?.monthlyTrend ?? [],
    categoryBreakdown: dashboardData?.categoryBreakdown ?? [],
    wishGoals: dashboardData?.wishGoals ?? [],
    memberContribution: dashboardData?.memberContribution ?? [],
  };

  // KPI卡片数据
  const kpiCards = useMemo(() => {
    const trendIcon = data.summary.balanceTrend === 'up' ? TrendingUp : TrendingDown;
    const trendColor = data.summary.balanceTrend === 'up' ? 'text-income' : 'text-expense';
    const trendText = data.summary.balanceTrend === 'up' ? '较上月增加' : '较上月减少';
    const diff = Math.abs(data.summary.balance - data.summary.previousBalance);

    return [
      {
        label: '本月收入',
        value: data.summary.totalIncome,
        icon: ArrowUpRight,
        color: 'text-income',
        bgColor: 'bg-income/10',
      },
      {
        label: '本月支出',
        value: data.summary.totalExpense,
        icon: ArrowDownRight,
        color: 'text-expense',
        bgColor: 'bg-expense/10',
      },
      {
        label: '本月结余',
        value: data.summary.balance,
        icon: Wallet,
        color: 'text-primary',
        bgColor: 'bg-primary/10',
        trend: { icon: trendIcon, color: trendColor, text: `${trendText} ${formatCurrency(diff)}` },
      },
      {
        label: '预算剩余',
        value: data.budgetProgress.remaining,
        icon: Target,
        color: data.budgetProgress.percentage >= 90 ? 'text-expense' : 'text-primary',
        bgColor: data.budgetProgress.percentage >= 90 ? 'bg-expense/10' : 'bg-primary/10',
        trend: { icon: null, color: 'text-text-tertiary', text: `已用 ${formatPercentage(data.budgetProgress.percentage)}` },
      },
    ];
  }, [data]);

  // Loading 状态（家庭或仪表盘任一加载中）
  if (isLoading || familyQuery.isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  // 错误态：明确提示，而非静默空白仪表盘（缺陷：原实现仅处理 isLoading，接口失败时空白/崩溃）
  const activeError = error ?? familyQuery.error;
  if (isError || familyQuery.isError) {
    return (
      <div className="page-container">
        <Card className="mt-10">
          <CardHeader>
            <CardTitle className="text-base text-expense">加载失败</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-text-secondary">
              {activeError?.message || '仪表盘数据加载失败，请稍后重试'}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                familyQuery.refetch();
                refetch();
              }}
            >
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 月份切换
  const handlePrevMonth = () => {
    if (displayMonth === 1) {
      setDisplayMonth(12);
      setDisplayYear(displayYear - 1);
    } else {
      setDisplayMonth(displayMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (displayMonth === 12) {
      setDisplayMonth(1);
      setDisplayYear(displayYear + 1);
    } else {
      setDisplayMonth(displayMonth + 1);
    }
  };

  return (
    <div className="page-container">
      {/* 标题栏 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            欢迎回来，{user?.nickname || '用户'} 👋
          </h1>
          <p className="text-text-secondary mt-1">这是你的家庭财务概览</p>
        </div>

        {/* 月份切换器 */}
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
        </div>
      </div>

      {/* KPI 卡片区 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs md:text-sm text-text-secondary">{kpi.label}</span>
                <div className={`w-9 h-9 md:w-10 md:h-10 rounded-lg ${kpi.bgColor} flex items-center justify-center`}>
                  <Icon size={18} className={kpi.color} />
                </div>
              </div>
              <p className={`text-xl md:text-2xl font-bold ${kpi.color} tabular-nums`}>
                {formatCurrency(kpi.value)}
              </p>
              {kpi.trend && (
                <div className="flex items-center gap-1 mt-2">
                  {kpi.trend.icon && <kpi.trend.icon size={12} className={kpi.trend.color} />}
                  <span className={`text-xs ${kpi.trend.color}`}>{kpi.trend.text}</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* 图表区域 */}
      <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-3'} gap-4 mb-6`}>
        {/* 收支趋势折线图 - 占2列 */}
        <Card className={isMobile ? '' : 'col-span-2'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">收支趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              xLabels={data.monthlyTrend.map((t) => t.month)}
              series={[
                { name: '收入', data: data.monthlyTrend.map((t) => t.income), color: '#16A34A', areaStyle: true },
                { name: '支出', data: data.monthlyTrend.map((t) => t.expense), color: '#DC2626', areaStyle: true },
              ]}
              height={isMobile ? 240 : 280}
            />
          </CardContent>
        </Card>

        {/* 分类支出饼图 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">支出分类</CardTitle>
          </CardHeader>
          <CardContent>
            <PieChart
              data={data.categoryBreakdown.map((c) => ({
                name: c.name,
                value: c.amount,
                color: c.color,
              }))}
              height={isMobile ? 240 : 280}
              centerLabel="总支出"
              centerValue={formatCurrency(data.summary.totalExpense)}
            />
          </CardContent>
        </Card>
      </div>

      {/* 预算执行概览 + 最近交易 */}
      <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-3'} gap-4 mb-6`}>
        {/* 预算执行概览 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">预算执行</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-text-secondary">总预算</span>
                <span className="text-sm font-medium text-text-primary tabular-nums">
                  {formatCurrency(data.budgetProgress.totalSpent)} / {formatCurrency(data.budgetProgress.totalBudget)}
                </span>
              </div>
              <Progress
                value={data.budgetProgress.percentage}
                indicatorClassName={
                  data.budgetProgress.percentage >= 90
                    ? 'bg-expense'
                    : data.budgetProgress.percentage >= 70
                      ? 'bg-budget-warning'
                      : 'bg-primary'
                }
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-text-tertiary">
                  已用 {formatPercentage(data.budgetProgress.percentage)}
                </span>
                <span className="text-xs font-medium text-primary tabular-nums">
                  剩余 {formatCurrency(data.budgetProgress.remaining)}
                </span>
              </div>
            </div>

            {/* 心愿目标 */}
            {data.wishGoals.map((goal) => (
              <div key={goal.id} className="pt-3 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Target size={14} className="text-primary" />
                    <span className="text-sm font-medium text-text-primary">{goal.name}</span>
                  </div>
                  <Badge variant="secondary">{formatPercentage(goal.percentage)}</Badge>
                </div>
                <Progress value={goal.percentage} indicatorClassName="bg-primary" />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-text-tertiary tabular-nums">
                    {formatCurrency(goal.current)}
                  </span>
                  <span className="text-xs text-text-tertiary tabular-nums">
                    {formatCurrency(goal.target)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 最近交易 */}
        <Card className={isMobile ? '' : 'col-span-2'}>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-base">最近交易</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-primary"
              onClick={() => setQuickRecordOpen(true)}
            >
              <Sparkles size={14} />
              快速记账
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {data.recentTransactions.map((tx: Transaction) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-primary-50/50 transition-colors cursor-pointer"
                >
                  {/* 分类色标 */}
                  <div
                    className="w-2 h-8 rounded-full shrink-0"
                    style={{ backgroundColor: tx.category?.color || '#A8A8A8' }}
                  />

                  {/* 交易信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {tx.merchant || tx.note || '未命名交易'}
                      </span>
                      {tx.isLargeExpense && (
                        <Badge variant="destructive" className="shrink-0">大额</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-tertiary">
                      <CategoryTag category={tx.category} />
                      <span>·</span>
                      <span>{formatDate(tx.date, 'MM-dd HH:mm')}</span>
                    </div>
                  </div>

                  {/* 金额 */}
                  <AmountText
                    amount={tx.amount}
                    type={tx.type}
                    size="md"
                  />
                </div>
              ))}
            </div>

            <div className="px-6 py-3 border-t border-border">
              <Button variant="ghost" className="w-full text-primary" size="sm">
                查看全部交易
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 成员贡献 */}
      {!isMobile && data.memberContribution.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">成员贡献</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {data.memberContribution.map((member) => (
                <div key={member.userId} className="flex items-center gap-3 p-3 rounded-lg bg-primary-50/30">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                    <span className="text-sm font-medium text-primary-600">
                      {(member.nickname || '').charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-text-primary">{member.nickname}</div>
                    <div className="text-xs text-text-tertiary">
                      记账 {member.count} 笔 · 支出 {formatCurrency(member.expense)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-expense tabular-nums">
                      {formatCurrency(member.expense)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

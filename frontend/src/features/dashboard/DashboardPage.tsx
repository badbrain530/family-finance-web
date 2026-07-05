import { useState, useMemo } from 'react';
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
import { useIsMobile } from '@/hooks/useMediaQuery';
import type { DashboardData } from '@/types/report';
import type { Transaction, TransactionType } from '@/types/transaction';

/**
 * 仪表盘主页面（W-02, P0）
 * 包含：4个KPI卡片、收支趋势折线图、分类支出饼图、
 * 最近交易列表、预算执行概览
 */

// 模拟数据（后续接入真实API替换）
const mockDashboardData: DashboardData = {
  summary: {
    totalIncome: 18500,
    totalExpense: 12380.5,
    balance: 6119.5,
    previousBalance: 5200,
    balanceTrend: 'up',
  },
  budgetProgress: {
    totalBudget: 15000,
    totalSpent: 12380.5,
    percentage: 82.5,
    remaining: 2619.5,
  },
  recentTransactions: [
    { id: '1', ledgerId: 'l1', userId: 'u1', categoryId: 'c1', type: 'expense' as TransactionType, amount: 35.5, date: '2026-07-04T12:30:00Z', merchant: '美团外卖', note: '午餐', source: 'quick_record' as any, importRecordId: null, aiConfidence: 0.92, aiCorrected: false, isLargeExpense: false, createdAt: '', updatedAt: '', currency: 'CNY', metadata: null, tags: [], category: { id: 'c1', name: '在外就餐', color: '#FF5252', familyId: '', parentId: null, icon: '', sortOrder: 0, isSystem: true, createdAt: '' } },
    { id: '2', ledgerId: 'l1', userId: 'u1', categoryId: 'c2', type: 'income' as TransactionType, amount: 18500, date: '2026-07-01T09:00:00Z', merchant: '公司', note: '7月工资', source: 'manual' as any, importRecordId: null, aiConfidence: null, aiCorrected: false, isLargeExpense: false, createdAt: '', updatedAt: '', currency: 'CNY', metadata: null, tags: [], category: { id: 'c2', name: '基本工资', color: '#00C896', familyId: '', parentId: null, icon: '', sortOrder: 0, isSystem: true, createdAt: '' } },
    { id: '3', ledgerId: 'l1', userId: 'u1', categoryId: 'c3', type: 'expense' as TransactionType, amount: 1280, date: '2026-07-03T18:00:00Z', merchant: '华润万家', note: '周末采购', source: 'manual' as any, importRecordId: null, aiConfidence: 0.88, aiCorrected: false, isLargeExpense: true, createdAt: '', updatedAt: '', currency: 'CNY', metadata: null, tags: [], category: { id: 'c3', name: '米面粮油', color: '#FF6B6B', familyId: '', parentId: null, icon: '', sortOrder: 0, isSystem: true, createdAt: '' } },
    { id: '4', ledgerId: 'l1', userId: 'u1', categoryId: 'c4', type: 'expense' as TransactionType, amount: 45, date: '2026-07-03T08:00:00Z', merchant: '滴滴出行', note: '打车上班', source: 'quick_record' as any, importRecordId: null, aiConfidence: 0.95, aiCorrected: false, isLargeExpense: false, createdAt: '', updatedAt: '', currency: 'CNY', metadata: null, tags: [], category: { id: 'c4', name: '出租车/网约车', color: '#FDD663', familyId: '', parentId: null, icon: '', sortOrder: 0, isSystem: true, createdAt: '' } },
    { id: '5', ledgerId: 'l1', userId: 'u1', categoryId: 'c5', type: 'expense' as TransactionType, amount: 120, date: '2026-07-02T20:00:00Z', merchant: '万达影院', note: '看电影', source: 'manual' as any, importRecordId: null, aiConfidence: 0.9, aiCorrected: false, isLargeExpense: false, createdAt: '', updatedAt: '', currency: 'CNY', metadata: null, tags: [], category: { id: 'c5', name: '文化娱乐', color: '#C48EC4', familyId: '', parentId: null, icon: '', sortOrder: 0, isSystem: true, createdAt: '' } },
  ],
  monthlyTrend: [
    { month: '2月', income: 17500, expense: 11200 },
    { month: '3月', income: 18200, expense: 13500 },
    { month: '4月', income: 18500, expense: 10800 },
    { month: '5月', income: 18500, expense: 14200 },
    { month: '6月', income: 19000, expense: 11800 },
    { month: '7月', income: 18500, expense: 12380.5 },
  ],
  categoryBreakdown: [
    { categoryId: 'c1', name: '食品烟酒', amount: 4200, color: '#FF6B6B' },
    { categoryId: 'c2', name: '居住', amount: 3500, color: '#45B7D1' },
    { categoryId: 'c3', name: '交通通信', amount: 1800, color: '#FFEAA7' },
    { categoryId: 'c4', name: '教育文化', amount: 1500, color: '#DDA0DD' },
    { categoryId: 'c5', name: '生活用品', amount: 980, color: '#96CEB4' },
    { categoryId: 'c6', name: '其他', amount: 400.5, color: '#A8A8A8' },
  ],
  wishGoals: [
    { id: 'w1', name: '日本旅行基金', current: 8500, target: 15000, percentage: 56.7 },
  ],
  memberContribution: [
    { userId: 'u1', nickname: '我', expense: 8200, count: 45 },
    { userId: 'u2', nickname: '伴侣', expense: 4180.5, count: 28 },
  ],
};

export function DashboardPage() {
  const { user } = useAuthStore();
  const { setQuickRecordOpen } = useUIStore();
  const isMobile = useIsMobile();
  const { year, month } = getCurrentYearMonth();
  const [displayYear, setDisplayYear] = useState(year);
  const [displayMonth, setDisplayMonth] = useState(month);

  const data = mockDashboardData;

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
                      {member.nickname.charAt(0)}
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

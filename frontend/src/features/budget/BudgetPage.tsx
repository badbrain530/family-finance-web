import { useState } from 'react';
import {
  Wallet,
  Target,
  TrendingUp,
  Sparkles,
  Plus,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn, formatCurrency, formatPercentage, getCurrentYearMonth } from '@/lib/utils';
import { MONTH_NAMES } from '@/lib/constants';

/**
 * 预算管理页面
 * 3个KPI + 分类预算进度条 + 心愿目标
 */

// 模拟分类预算数据
const mockCategoryBudgets = [
  { categoryId: 'c1', categoryName: '食品烟酒', categoryColor: '#FF6B6B', budget: 5000, spent: 4200, percentage: 84 },
  { categoryId: 'c2', categoryName: '居住', categoryColor: '#45B7D1', budget: 4000, spent: 3500, percentage: 87.5 },
  { categoryId: 'c3', categoryName: '交通通信', categoryColor: '#FFEAA7', budget: 2000, spent: 1800, percentage: 90 },
  { categoryId: 'c4', categoryName: '教育文化', categoryColor: '#DDA0DD', budget: 1500, spent: 1500, percentage: 100 },
  { categoryId: 'c5', categoryName: '生活用品', categoryColor: '#96CEB4', budget: 1000, spent: 980, percentage: 98 },
  { categoryId: 'c6', categoryName: '医疗保健', categoryColor: '#FF8C94', budget: 500, spent: 120, percentage: 24 },
  { categoryId: 'c7', categoryName: '其他', categoryColor: '#A8A8A8', budget: 1000, spent: 280.5, percentage: 28.05 },
];

// 模拟心愿目标
const mockWishGoals = [
  { id: 'w1', name: '日本旅行基金', current: 8500, target: 15000, percentage: 56.7, targetDate: '2026-10-01', icon: '✈️', color: '#45B7D1' },
  { id: 'w2', name: '新 MacBook', current: 6200, target: 12000, percentage: 51.7, targetDate: '2026-12-01', icon: '💻', color: '#DDA0DD' },
  { id: 'w3', name: '家庭应急基金', current: 15000, target: 30000, percentage: 50, targetDate: null, icon: '🛡️', color: '#96CEB4' },
];

export function BudgetPage() {
  const { year, month } = getCurrentYearMonth();
  const [displayMonth, setDisplayMonth] = useState(month);

  // 总预算汇总
  const totalBudget = mockCategoryBudgets.reduce((sum, c) => sum + c.budget, 0);
  const totalSpent = mockCategoryBudgets.reduce((sum, c) => sum + c.spent, 0);
  const totalRemaining = totalBudget - totalSpent;
  const overallPercentage = (totalSpent / totalBudget) * 100;

  // KPI卡片
  const kpiCards = [
    {
      label: '总预算',
      value: totalBudget,
      icon: Wallet,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      desc: `${MONTH_NAMES[displayMonth - 1]}预算`,
    },
    {
      label: '已使用',
      value: totalSpent,
      icon: TrendingUp,
      color: overallPercentage >= 90 ? 'text-expense' : 'text-budget-warning',
      bgColor: overallPercentage >= 90 ? 'bg-expense/10' : 'bg-budget-warning/10',
      desc: `${formatPercentage(overallPercentage)} 已用`,
    },
    {
      label: '剩余可用',
      value: totalRemaining,
      icon: Target,
      color: 'text-income',
      bgColor: 'bg-income/10',
      desc: `还能用 ${formatCurrency(totalRemaining)}`,
    },
  ];

  // 获取进度条颜色
  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-expense';
    if (percentage >= 80) return 'bg-budget-warning';
    return 'bg-primary';
  };

  // 获取预算状态标签
  const getBudgetBadge = (percentage: number) => {
    if (percentage >= 100) return <Badge variant="destructive" className="text-xs">已超支</Badge>;
    if (percentage >= 90) return <Badge variant="destructive" className="text-xs">即将超支</Badge>;
    if (percentage >= 80) return <Badge variant="warning" className="text-xs">注意</Badge>;
    return <Badge variant="success" className="text-xs">正常</Badge>;
  };

  return (
    <div className="page-container">
      {/* 标题栏 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">预算管理</h1>
          <p className="text-text-secondary mt-1">设定月度预算，追踪支出进度</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={displayMonth}
            onChange={(e) => setDisplayMonth(Number(e.target.value))}
            className="h-10 px-3 text-sm bg-surface border border-border rounded-lg outline-none focus:border-primary"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={idx} value={idx + 1}>{year}年{name}</option>
            ))}
          </select>
          <Button>
            <Sparkles size={14} />
            AI推荐预算
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
              <p className="text-xs text-text-tertiary mt-1">{kpi.desc}</p>
            </Card>
          );
        })}
      </div>

      {/* 总预算进度 */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-text-primary">总预算执行进度</h3>
          <span className="text-sm font-medium text-text-primary tabular-nums">
            {formatCurrency(totalSpent)} / {formatCurrency(totalBudget)}
          </span>
        </div>
        <Progress
          value={overallPercentage}
          className="h-3"
          indicatorClassName={getProgressColor(overallPercentage)}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-text-tertiary">
            已用 {formatPercentage(overallPercentage)}
          </span>
          <span className="text-xs font-medium text-income tabular-nums">
            剩余 {formatCurrency(totalRemaining)}
          </span>
        </div>
      </Card>

      {/* 分类预算列表 */}
      <Card className="mb-6">
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-base">分类预算</CardTitle>
          <Button variant="outline" size="sm">
            <Plus size={14} />
            添加预算
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {mockCategoryBudgets.map((cat) => (
            <div key={cat.categoryId}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: cat.categoryColor }}
                  />
                  <span className="text-sm font-medium text-text-primary">{cat.categoryName}</span>
                  {getBudgetBadge(cat.percentage)}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-text-secondary tabular-nums">
                    {formatCurrency(cat.spent)} / {formatCurrency(cat.budget)}
                  </span>
                </div>
              </div>
              <Progress
                value={Math.min(cat.percentage, 100)}
                className="h-2"
                indicatorClassName={getProgressColor(cat.percentage)}
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-text-tertiary">
                  {formatPercentage(cat.percentage)}
                </span>
                <span className={cn(
                  'text-xs tabular-nums',
                  cat.percentage >= 100 ? 'text-expense' : 'text-text-tertiary',
                )}>
                  {cat.percentage >= 100
                    ? `超支 ${formatCurrency(cat.spent - cat.budget)}`
                    : `剩余 ${formatCurrency(cat.budget - cat.spent)}`}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 心愿目标 */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-base">心愿目标</CardTitle>
          <Button variant="outline" size="sm">
            <Plus size={14} />
            新建目标
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mockWishGoals.map((goal) => (
              <div
                key={goal.id}
                className="p-4 rounded-xl border border-border hover:border-primary-200 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{goal.icon}</span>
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary">{goal.name}</h4>
                      {goal.targetDate && (
                        <div className="flex items-center gap-1 text-xs text-text-tertiary">
                          <Calendar size={10} />
                          {goal.targetDate}
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary">{formatPercentage(goal.percentage)}</Badge>
                </div>

                <Progress
                  value={goal.percentage}
                  className="h-2 mb-2"
                  indicatorClassName="bg-primary"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-tertiary tabular-nums">
                    {formatCurrency(goal.current)}
                  </span>
                  <span className="text-text-tertiary tabular-nums">
                    {formatCurrency(goal.target)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

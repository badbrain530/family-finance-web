import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
import { getCurrentFamily } from '@/services/family.service';
import { getMonthlyReport, generateMonthlyReport } from '@/services/report.service';
import { useToast } from '@/components/ui/toast';

/**
 * AI洞察月报页面（根因修复版）
 *
 * 改动要点（最小变更）：
 * 1. 删除全部写死假数据（mockReport）与 `return null` 的占位 queryFn。
 * 2. familyId 取自真实「当前家庭」getCurrentFamily()，不再硬编码 'f1'。
 * 3. 接入真实月报接口 getMonthlyReport / generateMonthlyReport。
 * 4. 无月报（后端 3004）时展示「生成月报」空状态，点击生成后 refetch。
 * 5. 保留并发防御：report 某字段缺失时用 ?? [] / 默认值兜底，避免结构不全崩溃。
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
  const { toast } = useToast();

  // 当前家庭（正确的 familyId 来源，对齐 DashboardPage）
  const familyQuery = useQuery({
    queryKey: ['currentFamily'],
    queryFn: getCurrentFamily,
  });
  const familyId = familyQuery.data?.id ?? '';

  // 月报查询（真实接口）。queryKey 含年月，切换月份自动重新请求。
  const {
    data: reportData,
    isLoading: isReportLoading,
    isError: isReportError,
    error: reportError,
    refetch: refetchReport,
  } = useQuery<MonthlyReport>({
    queryKey: ['monthly-report', familyId, displayYear, displayMonth],
    queryFn: () => getMonthlyReport(familyId, displayYear, displayMonth),
    enabled: !!familyId,
    retry: false,
  });

  // 生成月报（点击空状态的「生成月报」按钮触发）
  const generateMutation = useMutation({
    mutationFn: () => generateMonthlyReport(familyId, displayYear, displayMonth),
    onSuccess: () => {
      toast({ title: '月报已生成', description: '已基于本月真实交易数据统计', variant: 'success' });
      refetchReport();
    },
    onError: (err: Error) => {
      toast({
        title: '生成失败',
        description: err?.message || '请稍后重试',
        variant: 'destructive',
      });
    },
  });

  // 加载态：家庭或月报任一加载中（且已拿到 familyId 才显示月报加载）
  if (familyQuery.isLoading || (isReportLoading && familyId)) {
    return <LoadingSpinner fullScreen />;
  }

  // 家庭加载失败
  if (familyQuery.isError) {
    return (
      <div className="page-container">
        <Card className="mt-10">
          <CardHeader>
            <CardTitle className="text-base text-expense">加载家庭失败</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-text-secondary">
              {familyQuery.error?.message || '加载家庭信息失败，请稍后重试'}
            </p>
            <Button variant="outline" onClick={() => familyQuery.refetch()}>
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 并发防御：缺失字段兜底，保证结构完整、可安全渲染
  const report: MonthlyReport | null = reportData
    ? {
        ...reportData,
        categoryBreakdown: reportData.categoryBreakdown ?? [],
        anomalies: reportData.anomalies ?? [],
        advice: reportData.advice ?? [],
        readBy: reportData.readBy ?? [],
        previousMonthBalance: reportData.previousMonthBalance ?? 0,
        benchmarkComparison: reportData.benchmarkComparison ?? null,
      }
    : null;

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

  // 渲染已有月报内容（入参已确保非 null，规避闭包内可空收窄问题）
  const renderReportContent = (r: MonthlyReport) => {
    const balanceChange = r.balance - (r.previousMonthBalance || 0);
    const balanceChangePercent = r.previousMonthBalance
      ? ((balanceChange / r.previousMonthBalance) * 100)
      : 0;
    const isBalanceUp = balanceChange > 0;

    const kpiCards = [
      {
        label: '本月收入',
        value: r.totalIncome,
        icon: ArrowUpRight,
        color: 'text-income',
        bgColor: 'bg-income/10',
        change: null,
      },
      {
        label: '本月支出',
        value: r.totalExpense,
        icon: ArrowDownRight,
        color: 'text-expense',
        bgColor: 'bg-expense/10',
        change: null,
      },
      {
        label: '本月结余',
        value: r.balance,
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

    return (
      <>
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
              xLabels={r.categoryBreakdown.map((c) => c.categoryName)}
              series={[
                {
                  name: '本月',
                  data: r.categoryBreakdown.map((c) => c.amount),
                  color: '#3B82F6',
                },
                {
                  name: '上月',
                  data: r.categoryBreakdown.map((c) => c.previousMonthAmount || 0),
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
            {r.advice.map((advice) => {
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
        {r.anomalies.length > 0 && (
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
              {r.anomalies.map((anomaly, idx) => (
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
      </>
    );
  };

  return (
    <div className="page-container">
      {/* 标题栏 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">AI财务洞察月报</h1>
          <p className="text-text-secondary mt-1">
            {displayYear}年{MONTH_NAMES[displayMonth - 1]}财务报告
            {report ? ` · AI生成于 ${formatDate(report.generatedAt, 'MM-dd HH:mm')}` : ''}
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
          {report && (
            <Button variant="outline" size="sm">
              <Download size={14} />
              导出
            </Button>
          )}
        </div>
      </div>

      {/* 空状态：本月暂无月报（后端 3004）→ 引导生成 */}
      {isReportError ? (
        <Card className="mt-10">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles size={18} className="text-primary" />
              </div>
              <CardTitle className="text-base">本月暂无月报</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-text-secondary">
              {reportError?.message || '该月还没有生成月报，点击下方按钮基于本月真实交易数据生成。'}
            </p>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? '生成中...' : '生成月报'}
            </Button>
          </CardContent>
        </Card>
      ) : report ? (
        renderReportContent(report)
      ) : null}
    </div>
  );
}

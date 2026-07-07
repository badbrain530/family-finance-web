import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * 回归测试：React #310 "Rendered more hooks than during the previous render"
 *
 * 根因：DashboardPage 曾有第 8 个 Hook（useMemo 计算 kpiCards）位于两个提前 return
 * 之后，导致「loading 首屏（命中提前 return，只调 7~8 个 Hook）」与「数据返回后的完整渲染
 * （多调了 useMemo，Hook 数量 +1）」两次渲染的 Hook 数量不一致，触发 #310。
 *
 * 修复做法：把 useMemo 上移到提前 return 之前，使所有 Hook 每次渲染顺序/数量一致。
 *
 * 本测试模拟「loading 态首屏渲染 → 数据返回后二次渲染」的切换，断言：
 *   1) 整个过程中没有抛出 "Rendered more hooks than during the previous render"；
 *   2) 数据返回后能正常渲染出 KPI 卡片区域。
 *
 * 若修复被回退（useMemo 再次落到提前 return 之后），第 2 次渲染会多出一个 Hook，
 * 与首屏 Hook 数量不一致，React 会抛 #310，测试将失败。
 */

// 用 vi.hoisted 捕获可控 promise 的 resolver，供 vi.mock 工厂与测试用例共享。
// （vi.mock 工厂是“提升”执行的，无法直接引用外部作用域变量，必须借助 hoisted。）
const h = vi.hoisted(() => {
  const resolvers = {
    family: null as null | ((v: any) => void),
    dashboard: null as null | ((v: any) => void),
  };
  return {
    resolvers,
    mockGetCurrentFamily: vi.fn(() => new Promise<any>((r) => { resolvers.family = r; })),
    mockGetDashboardData: vi.fn(() => new Promise<any>((r) => { resolvers.dashboard = r; })),
  };
});

vi.mock('@/services/family.service', () => ({
  getCurrentFamily: h.mockGetCurrentFamily,
}));
vi.mock('@/services/dashboard.service', () => ({
  getDashboardData: h.mockGetDashboardData,
}));

// echarts 在 jsdom 下无法渲染（无 canvas / ResizeObserver），mock 掉图表组件，
// 让测试聚焦在「Hook 调用顺序」这一回归点上，避免无关噪声。
vi.mock('@/components/charts/LineChart', () => ({
  LineChart: () => <div data-testid="line-chart" />,
}));
vi.mock('@/components/charts/PieChart', () => ({
  PieChart: () => <div data-testid="pie-chart" />,
}));

import { DashboardPage } from './DashboardPage';

const mockFamily = {
  id: 'family-1',
  name: '测试家庭',
  ownerId: 'u1',
  avatar: null,
  inviteCode: 'ABC123',
  inviteCodeExpiry: '',
  createdAt: '',
  updatedAt: '',
};

const mockDashboard = {
  summary: {
    totalIncome: 1000,
    totalExpense: 500,
    balance: 500,
    previousBalance: 400,
    balanceTrend: 'up' as const,
  },
  budgetProgress: { totalBudget: 2000, totalSpent: 800, percentage: 40, remaining: 1200 },
  recentTransactions: [
    {
      id: 't1',
      ledgerId: 'l1',
      userId: 'u1',
      categoryId: 'c1',
      accountId: null,
      type: 'expense' as const,
      amount: 50,
      date: '2026-07-01T10:00:00',
      merchant: '超市',
      note: null,
      source: 'manual' as const,
      importRecordId: null,
      aiConfidence: null,
      aiCorrected: false,
      isLargeExpense: false,
      createdAt: '',
      updatedAt: '',
      currency: 'CNY',
      metadata: null,
      tags: [],
      category: { id: 'c1', name: '购物', color: '#FF0000' },
    },
  ],
  monthlyTrend: [{ month: '1月', income: 1000, expense: 500 }],
  categoryBreakdown: [{ categoryId: 'c1', name: '购物', amount: 300, color: '#FF0000' }],
  wishGoals: [{ id: 'g1', name: '旅游', current: 2000, target: 5000, percentage: 40 }],
  memberContribution: [{ userId: 'u1', nickname: '小明', expense: 500, count: 10 }],
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('DashboardPage 回归：React #310 (Hook 调用顺序)', () => {
  it('loading → loaded 切换不抛 "Rendered more hooks"，且正常渲染 KPI 卡片', async () => {
    // 捕获 React 在 Hook 数量不一致时通过 console.error 输出的 invariant 报错
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const wrapper = createWrapper();
    render(<DashboardPage />, { wrapper });

    // 首屏处于 loading 态（命中提前 return，仅渲染 LoadingSpinner），KPI 区域尚未出现
    expect(screen.queryByText('本月收入')).not.toBeInTheDocument();

    // 1) 家庭查询返回 → familyId 就绪，仪表盘查询被启用并进入 loading（仍为提前 return）
    await act(async () => {
      h.resolvers.family?.(mockFamily);
    });

    // 等仪表盘查询真正发起（familyId 就绪后才会调用 getDashboardData）
    await waitFor(() => {
      expect(h.mockGetDashboardData).toHaveBeenCalled();
    });

    // 2) 仪表盘查询返回 → 进入「完整渲染」分支
    await act(async () => {
      h.resolvers.dashboard?.(mockDashboard);
    });

    // KPI 卡片区域成功渲染：说明 loading→loaded 两次渲染 Hook 数量一致，未触发 #310
    await waitFor(() => {
      expect(screen.getByText('本月收入')).toBeInTheDocument();
    });

    expect(screen.getByText('本月支出')).toBeInTheDocument();
    expect(screen.getByText('本月结余')).toBeInTheDocument();
    expect(screen.getByText('预算剩余')).toBeInTheDocument();

    // 关键断言：整个过程中不得出现 Hook 数量不一致的运行时错误
    const hookErrors = errorSpy.mock.calls.filter((args) =>
      String(args[0]).includes('Rendered more hooks than during the previous render'),
    );
    expect(hookErrors).toHaveLength(0);

    errorSpy.mockRestore();
  });
});

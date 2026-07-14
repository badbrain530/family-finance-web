import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TransactionListPage } from './TransactionListPage';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import {
  TransactionSource,
  TransactionType,
  type Transaction,
  type Category,
} from '@/types/transaction';

// 用 vi.hoisted 预置可被 vi.mock 工厂闭包引用的 mock 函数
const h = vi.hoisted(() => ({
  getTransactions: vi.fn(),
  batchDeleteTransactions: vi.fn(),
}));

vi.mock('@/services/transaction.service', () => ({
  getTransactions: (...a: unknown[]) => h.getTransactions(...a),
  batchDeleteTransactions: (...a: unknown[]) => h.batchDeleteTransactions(...a),
}));

const cat: Category = {
  id: 's1',
  familyId: 'fam1',
  parentId: 'c1',
  name: '三餐',
  icon: 'rice',
  color: '#FF6B6B',
  sortOrder: 0,
  isSystem: true,
  createdAt: '',
};

const tx: Transaction = {
  id: 't1',
  ledgerId: 'l1',
  userId: 'u1',
  categoryId: 's1',
  type: TransactionType.EXPENSE,
  amount: 88.5,
  date: '2024-03-01T10:00:00.000Z',
  merchant: '星巴克',
  note: null,
  source: TransactionSource.MANUAL,
  importRecordId: null,
  aiConfidence: null,
  aiCorrected: false,
  isLargeExpense: false,
  createdAt: '',
  updatedAt: '',
  currency: 'CNY',
  metadata: null,
  tags: [],
  refundStatus: 'NONE',
  reimbursementStatus: 'NONE',
  category: cat,
  user: { id: 'u1', nickname: '我' } as unknown as Transaction['user'],
};

const queryClient = new QueryClient();
const renderPage = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <TransactionListPage />
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  useUIStore.setState({ quickRecordOpen: false });
  useAuthStore.setState({
    user: { id: 'u1', nickname: '我' } as unknown as NonNullable<ReturnType<typeof useAuthStore.getState>['user']>,
    isAuthenticated: true,
  });
  h.getTransactions.mockResolvedValue({ items: [tx], total: 1, page: 1, pageSize: 10 });
  h.batchDeleteTransactions.mockResolvedValue({ successCount: 1, failedCount: 0 });
});

describe('TransactionListPage - 移除批量修改分类入口（Bug 修复）', () => {
  it('① 选中交易后批量栏仅含 全选/批量删除/取消，无「修改分类」', async () => {
    renderPage();

    // 列表渲染
    await waitFor(() => expect(screen.getByText('星巴克')).toBeInTheDocument());

    // 初始未选中：批量栏不显示「已选择」
    expect(screen.queryByText('已选择')).not.toBeInTheDocument();
    expect(screen.queryByText('修改分类')).not.toBeInTheDocument();

    // 勾选行 checkbox（第 2 个 checkbox 为数据行；第 1 个为表头全选）
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(checkboxes[1]);

    // 批量栏出现
    await waitFor(() => expect(screen.getByText(/已选择/)).toBeInTheDocument());

    // 仅保留的三个按钮
    expect(screen.getByRole('button', { name: /全选/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /批量删除/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();

    // 关键回归：页面上不得存在「修改分类」按钮 / 文案
    expect(screen.queryByRole('button', { name: /修改分类/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/修改分类/)).not.toBeInTheDocument();
  });

  it('② 批量删除链路仍可用：点击批量删除→确认→调用 batchDeleteTransactions', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('星巴克')).toBeInTheDocument());

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    await waitFor(() => expect(screen.getByText(/已选择/)).toBeInTheDocument());

    // 点击「批量删除」→ 弹出确认框
    fireEvent.click(screen.getByRole('button', { name: /批量删除/ }));
    await waitFor(() => expect(screen.getByText('确认批量删除')).toBeInTheDocument());

    // 确认删除 → 触发批量删除 mutation
    fireEvent.click(screen.getByRole('button', { name: /确认删除/ }));

    await waitFor(() => expect(h.batchDeleteTransactions).toHaveBeenCalled());
    const [ids] = h.batchDeleteTransactions.mock.calls[0] as [string[]];
    expect(ids).toEqual(['t1']);
  });
});

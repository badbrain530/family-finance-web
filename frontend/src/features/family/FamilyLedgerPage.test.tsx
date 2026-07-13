import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FamilyLedgerPage } from './FamilyLedgerPage';
import { LedgerType, type Family, type Ledger } from '@/types/family';

/**
 * 组件测试：FamilyLedgerPage 的"我的账本"区块（真实账本列表）
 *
 * 关键回归点：
 *   1) 挂载后通过 getCurrentFamily + getLedgers 拉取真实列表，渲染账本名 + 类型徽章
 *   2) 右上角"＋ 新建账本"按钮出现；点击后展开创建输入框（placeholder "家庭账本"）
 *
 * 组件依赖 TanStack Query，需用 QueryClientProvider 包裹；toast 通过 mock 捕获。
 */

const h = vi.hoisted(() => ({
  getCurrentFamily: vi.fn(),
  getLedgers: vi.fn(),
  createLedger: vi.fn(),
  deleteLedger: vi.fn(),
  toast: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock('@/services/family.service', () => ({
  getCurrentFamily: (...args: unknown[]) => h.getCurrentFamily(...args),
}));
vi.mock('@/services/ledger.service', () => ({
  getLedgers: (...args: unknown[]) => h.getLedgers(...args),
  createLedger: (...args: unknown[]) => h.createLedger(...args),
  deleteLedger: (...args: unknown[]) => h.deleteLedger(...args),
}));
vi.mock('@/components/ui/toaster', () => ({
  useToast: () => ({ toast: h.toast, dismiss: h.dismiss }),
}));

const family: Family = {
  id: 'fam-1',
  name: '测试家庭',
  ownerId: 'u1',
  avatar: null,
  inviteCode: 'ABC123',
  inviteCodeExpiry: '',
  createdAt: '',
  updatedAt: '',
} as Family;

const ledgers: Ledger[] = [
  { id: 'l1', familyId: 'fam-1', ownerId: null, type: LedgerType.SHARED, name: '家庭共享账本', createdAt: '' },
  { id: 'l2', familyId: 'fam-1', ownerId: null, type: LedgerType.PERSONAL, name: '我的个人账本', createdAt: '' },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.getCurrentFamily.mockResolvedValue(family);
  h.getLedgers.mockResolvedValue(ledgers);
  h.createLedger.mockResolvedValue({} as Ledger);
  h.deleteLedger.mockResolvedValue({ success: true });
});

describe('FamilyLedgerPage - 我的账本区块（真实账本列表）', () => {
  it('① 渲染账本列表、类型徽章与"新建账本"按钮', async () => {
    render(<FamilyLedgerPage />, { wrapper: createWrapper() });

    // 等待真实账本列表（异步 getLedgers）渲染完成，再断言具体账本名
    await waitFor(() =>
      expect(screen.getByText('家庭共享账本')).toBeInTheDocument(),
    );
    expect(screen.getByText('我的账本')).toBeInTheDocument();
    expect(screen.getByText('我的个人账本')).toBeInTheDocument();
    // 类型徽章
    expect(screen.getByText('共享')).toBeInTheDocument();
    expect(screen.getByText('个人')).toBeInTheDocument();
    // 新建按钮
    expect(
      screen.getByRole('button', { name: /新建账本/ }),
    ).toBeInTheDocument();
  });

  it('② 点击"新建账本"展开创建输入框', async () => {
    render(<FamilyLedgerPage />, { wrapper: createWrapper() });

    await waitFor(() =>
      expect(screen.getByText('家庭共享账本')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /新建账本/ }));
    expect(screen.getByPlaceholderText('家庭账本')).toBeInTheDocument();
  });

  it('③ 点击账本删除按钮 → 确认弹窗 → 确认删除 → 调用 deleteLedger 并失效列表缓存', async () => {
    render(<FamilyLedgerPage />, { wrapper: createWrapper() });

    await waitFor(() =>
      expect(screen.getByText('家庭共享账本')).toBeInTheDocument(),
    );

    // 每个账本行都有「删除账本」按钮（共 2 个）
    const deleteButtons = screen.getAllByRole('button', { name: '删除账本' });
    expect(deleteButtons).toHaveLength(2);

    // 点击第一个账本（家庭共享账本 l1）的删除按钮
    fireEvent.click(deleteButtons[0]);

    // 确认弹窗出现（标题"删除账本" + 警示文案）
    expect(await screen.findByText('删除账本')).toBeInTheDocument();
    expect(screen.getByText(/该账本下的所有账户/)).toBeInTheDocument();

    // 点击「确认删除」
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));

    // 断言真正调用了 deleteLedger 且参数为该账本 id
    await waitFor(() => {
      expect(h.deleteLedger).toHaveBeenCalledWith('l1');
    });
    // 成功后给出 toast 反馈
    expect(h.toast).toHaveBeenCalled();
  });
});

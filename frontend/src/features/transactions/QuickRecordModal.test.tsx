import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QuickRecordModal } from './QuickRecordModal';
import { useUIStore } from '@/store/uiStore';
import { LedgerType, type Family, type Ledger } from '@/types/family';

const queryClient = new QueryClient();
const renderWithClient = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

/**
 * 组件测试：QuickRecordModal（Bug A 修复——无账本时可在弹窗内直接新建账本）
 *
 * 关键回归点：
 *   1) 无账本（getLedgers 返回 []）打开弹窗 → 渲染"新建账本"面板（"还没有账本"提示 + "创建账本"按钮）
 *   2) 触发 handleCreateLedger → createLedger 被调用且参数正确（familyId, name, type=shared），
 *      新建账本被加入列表、ledgerId 被选中，新建面板消失
 *   3) 全程不得再出现指向不存在"账本管理"页的死路文案（即 toast 文案不得含"账本管理"）
 *
 * useToast 通过 mock '@/components/ui/toaster' 捕获调用，用于验证死路文案已移除。
 */

const h = vi.hoisted(() => ({
  getLedgers: vi.fn(),
  createLedger: vi.fn(),
  getCurrentFamily: vi.fn(),
  getAccounts: vi.fn(),
  quickRecord: vi.fn(),
  toast: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock('@/services/ledger.service', () => ({
  getLedgers: (...args: unknown[]) => h.getLedgers(...args),
  createLedger: (...args: unknown[]) => h.createLedger(...args),
}));
vi.mock('@/services/family.service', () => ({
  getCurrentFamily: (...args: unknown[]) => h.getCurrentFamily(...args),
}));
vi.mock('@/services/account.service', () => ({
  getAccounts: (...args: unknown[]) => h.getAccounts(...args),
}));
vi.mock('@/services/transaction.service', () => ({
  quickRecord: (...args: unknown[]) => h.quickRecord(...args),
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

const createdLedger: Ledger = {
  id: 'l-new',
  familyId: 'fam-1',
  ownerId: null,
  type: LedgerType.SHARED,
  name: '我的账本',
  createdAt: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  useUIStore.setState({ quickRecordOpen: false });
  h.getCurrentFamily.mockResolvedValue(family);
  h.getAccounts.mockResolvedValue([]);
  h.getLedgers.mockResolvedValue([]);
  h.createLedger.mockResolvedValue(createdLedger);
  h.quickRecord.mockResolvedValue({
    transaction: { category: { name: '餐饮' } },
    confidence: 0.9,
  });
});

describe('QuickRecordModal - 无账本时弹窗内新建账本（Bug A 修复）', () => {
  it('① 无账本场景：打开弹窗渲染"新建账本"面板，且不出现死路"账本管理"文案', async () => {
    useUIStore.setState({ quickRecordOpen: true });
    renderWithClient(<QuickRecordModal />);

    await waitFor(() =>
      expect(screen.getByText('还没有账本')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /创建账本/ })).toBeInTheDocument();
    // 关键回归：不应再出现指向不存在"账本管理"页的死路文案
    expect(screen.queryByText(/请先在账本管理中/)).not.toBeInTheDocument();
  });

  it('② 触发 handleCreateLedger：新建账本被加入列表、ledgerId 被选中，且不再出现死路文案', async () => {
    useUIStore.setState({ quickRecordOpen: true });
    renderWithClient(<QuickRecordModal />);

    // 等待进入新建账本面板
    await waitFor(() =>
      expect(screen.getByText('还没有账本')).toBeInTheDocument(),
    );

    // 输入账本名称并点击"创建账本"
    const nameInput = screen.getByPlaceholderText('家庭账本') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: '我的账本' } });
    fireEvent.click(screen.getByRole('button', { name: /创建账本/ }));

    // createLedger 被调用，且参数正确（familyId, name, type=shared）
    await waitFor(() => expect(h.createLedger).toHaveBeenCalledTimes(1));
    const [calledFamilyId, calledName, calledType] = h.createLedger.mock
      .calls[0] as [string, string, LedgerType];
    expect(calledFamilyId).toBe('fam-1');
    expect(calledName).toBe('我的账本');
    expect(calledType).toBe(LedgerType.SHARED);

    // 新建后：新建面板消失，账本被选中（select 触发区显示账本名）
    await waitFor(() =>
      expect(screen.queryByText('还没有账本')).not.toBeInTheDocument(),
    );
    // 选中后账本名出现在 Select 触发区（toast 未挂载，文案不会渲染到 DOM）
    expect(screen.getByText('我的账本')).toBeInTheDocument();

    // 全程不得出现死路文案
    const deadEndCalls = h.toast.mock.calls.filter((c) => {
      const arg = c[0] as { title?: string; description?: string };
      return [arg?.title, arg?.description].some(
        (t) => typeof t === 'string' && t.includes('账本管理'),
      );
    });
    expect(deadEndCalls).toHaveLength(0);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EditTransactionModal } from './EditTransactionModal';
import {
  TransactionType,
  TransactionSource,
  type Transaction,
  type Category,
  type Family,
} from '@/types/transaction';

// jsdom 默认缺失 PointerEvent 与指针捕获 API，Radix Select 在打开时会用到；
// 补最小实现，避免打开下拉时出现"hasPointerCapture is not a function"等误报。
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventMock extends MouseEvent {
    pointerId: number;
    isPrimary: boolean;
    pointerType: string;
    constructor(type: string, params: Record<string, unknown> = {}) {
      super(type, params);
      this.pointerId = (params.pointerId as number) ?? 0;
      this.isPrimary = (params.isPrimary as boolean) ?? false;
      this.pointerType = (params.pointerType as string) ?? 'mouse';
    }
  }
  // @ts-expect-error 测试环境注入
  globalThis.PointerEvent = PointerEventMock;
}
if (typeof Element !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
}

// 用 vi.hoisted 预置可被 vi.mock 工厂闭包引用的 mock 函数
const h = vi.hoisted(() => ({
  updateTransaction: vi.fn(),
  refundTransaction: vi.fn(),
  markReimbursement: vi.fn(),
  cancelReimbursement: vi.fn(),
  confirmReimbursement: vi.fn(),
  getCategories: vi.fn(),
  getAccounts: vi.fn(),
  getCurrentFamily: vi.fn(),
  toast: vi.fn(),
  dismiss: vi.fn(),
}));

vi.mock('@/services/transaction.service', () => ({
  updateTransaction: (...a: unknown[]) => h.updateTransaction(...a),
  refundTransaction: (...a: unknown[]) => h.refundTransaction(...a),
  markReimbursement: (...a: unknown[]) => h.markReimbursement(...a),
  cancelReimbursement: (...a: unknown[]) => h.cancelReimbursement(...a),
  confirmReimbursement: (...a: unknown[]) => h.confirmReimbursement(...a),
}));
vi.mock('@/services/category.service', () => ({
  getCategories: (...a: unknown[]) => h.getCategories(...a),
}));
vi.mock('@/services/account.service', () => ({
  getAccounts: (...a: unknown[]) => h.getAccounts(...a),
}));
vi.mock('@/services/family.service', () => ({
  getCurrentFamily: (...a: unknown[]) => h.getCurrentFamily(...a),
}));
vi.mock('@/components/ui/toaster', () => ({
  useToast: () => ({ toast: h.toast, dismiss: h.dismiss }),
}));

const family: Family = {
  id: 'fam-1',
  name: '测试家庭',
  ownerId: 'u1',
  avatar: null,
  inviteCode: 'ABC',
  inviteCodeExpiry: '',
  createdAt: '',
  updatedAt: '',
} as Family;

// 一个支出根（餐饮食品）+ 一个收入根（薪资收入），用于验证按交易类型过滤
const categories: Category[] = [
  {
    id: 'c1',
    familyId: 'fam-1',
    parentId: null,
    name: '餐饮食品',
    icon: 'utensils',
    color: '#FF6B6B',
    sortOrder: 0,
    isSystem: true,
    createdAt: '',
    children: [
      {
        id: 's1',
        familyId: 'fam-1',
        parentId: 'c1',
        name: '三餐',
        icon: 'rice',
        color: '#FF6B6B',
        sortOrder: 0,
        isSystem: true,
        createdAt: '',
      },
    ],
  },
  {
    id: 'c2',
    familyId: 'fam-1',
    parentId: null,
    name: '薪资收入',
    icon: 'wallet',
    color: '#4ECDC4',
    sortOrder: 1,
    isSystem: true,
    createdAt: '',
    children: [
      {
        id: 's2',
        familyId: 'fam-1',
        parentId: 'c2',
        name: '工资',
        icon: 'wallet',
        color: '#4ECDC4',
        sortOrder: 0,
        isSystem: true,
        createdAt: '',
      },
    ],
  },
];

const tx: Transaction = {
  id: 't1',
  ledgerId: 'l1',
  userId: 'u1',
  categoryId: 's1',
  type: TransactionType.EXPENSE,
  amount: 100,
  date: '2024-01-01T00:00:00.000Z',
  merchant: '麦当劳',
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
  category: {
    id: 's1',
    familyId: 'fam-1',
    parentId: 'c1',
    name: '三餐',
    icon: 'rice',
    color: '#FF6B6B',
    sortOrder: 0,
    isSystem: true,
    createdAt: '',
  },
  user: { id: 'u1', nickname: '我' } as unknown as Transaction['user'],
};

const queryClient = new QueryClient();
const renderModal = (open = true, transaction: Transaction | null = tx) =>
  render(
    <QueryClientProvider client={queryClient}>
      <EditTransactionModal
        transaction={transaction}
        open={open}
        onOpenChange={() => {}}
        onSaved={() => {}}
      />
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  h.getCurrentFamily.mockResolvedValue(family);
  h.getCategories.mockResolvedValue(categories);
  h.getAccounts.mockResolvedValue([]);
});

describe('EditTransactionModal - 分类下拉 SelectLabel 包裹在 SelectGroup 内（崩溃修复）', () => {
  it('① 打开编辑弹窗不崩溃，标题「编辑交易」正常渲染', () => {
    renderModal(true, tx);
    expect(screen.getByText('编辑交易')).toBeInTheDocument();
  });

  it('② 展开分类下拉：SelectLabel 位于 SelectGroup 内（不抛 "SelectLabel must be used within SelectGroup"），渲染分类组与子项', async () => {
    renderModal(true, tx);

    // 等待弹窗与分类/账户加载完成
    await waitFor(() => expect(screen.getByText('编辑交易')).toBeInTheDocument());
    await waitFor(() => expect(h.getCategories).toHaveBeenCalled());

    // 找到分类下拉触发器（id=edit-category），用键盘 ArrowDown 打开（绕开指针捕获）
    const trigger = document.getElementById('edit-category') as HTMLElement;
    expect(trigger).not.toBeNull();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    // 关键回归：分组标题与子项都应渲染，且不得抛 "SelectLabel must be used within SelectGroup"
    // 「餐饮食品」为下拉分组标题（唯一），「三餐」会同时出现在触发器(已选分类)与下拉项，
    // 故用 getAllByText 且至少出现 2 次，证明下拉项已随下拉打开而渲染（无崩溃）。
    await waitFor(() => expect(screen.getByText('餐饮食品')).toBeInTheDocument());
    expect(screen.getAllByText('三餐').length).toBeGreaterThanOrEqual(2);
    // 支出类型下应过滤掉收入分组（不会渲染「薪资收入」标签）
    expect(screen.queryByText('薪资收入')).not.toBeInTheDocument();
  });
});

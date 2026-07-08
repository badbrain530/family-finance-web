import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { CategoriesManagePage } from './CategoriesManagePage';
import type { Category, Family } from '@/types/transaction';

// 用 vi.hoisted 预置可被 vi.mock 工厂闭包引用的 mock 函数
const h = vi.hoisted(() => ({
  getCategories: vi.fn(),
  getCurrentFamily: vi.fn(),
  updateCategory: vi.fn(),
  reorderCategories: vi.fn(),
}));

const mockFamily: Family = {
  id: 'fam1',
  name: '测试家庭',
  ownerId: 'u1',
  inviteCode: 'ABC123',
  createdAt: '',
  updatedAt: '',
} as unknown as Family;

const s1: Category = { id: 's1', familyId: 'fam1', parentId: 'c1', name: '三餐', icon: 'rice', color: '#FF6B6B', sortOrder: 0, isSystem: true, createdAt: '' };
const s2: Category = { id: 's2', familyId: 'fam1', parentId: 'c1', name: '外卖', icon: 'bike', color: '#FFB8B8', sortOrder: 1, isSystem: true, createdAt: '' };
const s3: Category = { id: 's3', familyId: 'fam1', parentId: 'c1', name: '零食', icon: 'coffee', color: '#FF8E8E', sortOrder: 2, isSystem: false, createdAt: '' };

const c1: Category = { id: 'c1', familyId: 'fam1', parentId: null, name: '餐饮食品', icon: 'utensils', color: '#FF6B6B', sortOrder: 0, isSystem: true, createdAt: '', children: [s1, s2, s3] };
const c2: Category = { id: 'c2', familyId: 'fam1', parentId: null, name: '交通出行', icon: 'car', color: '#4ECDC4', sortOrder: 1, isSystem: true, createdAt: '', children: [] };

const mockCategories: Category[] = [c1, c2];

vi.mock('@/services/category.service', () => ({
  getCategories: (...args: unknown[]) => h.getCategories(...args),
  createCategory: () => Promise.resolve({}),
  updateCategory: (...args: unknown[]) => h.updateCategory(...args),
  deleteCategory: () => Promise.resolve({ success: true }),
  initCategories: () => Promise.resolve({ success: true, count: 0 }),
  reorderCategories: (...args: unknown[]) => h.reorderCategories(...args),
}));

vi.mock('@/services/family.service', () => ({
  getCurrentFamily: (...args: unknown[]) => h.getCurrentFamily(...args),
}));

// jsdom 未实现 PointerEvent，fireEvent.pointer* 会退化为普通 Event 而丢失
// clientX/isPrimary/button 等字段，导致 dnd-kit PointerSensor 直接 return。
// 这里补一个最小 Polyfill，使其 instanceof 与关键字段可用。
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

beforeEach(() => {
  vi.clearAllMocks();
  h.getCategories.mockResolvedValue(mockCategories);
  h.getCurrentFamily.mockResolvedValue(mockFamily);
  h.updateCategory.mockResolvedValue({});
  h.reorderCategories.mockResolvedValue({ success: true });
});

describe('CategoriesManagePage - 改名与拖拽排序', () => {
  it('① 系统一级分类改名保存：body 含 name 且不含 parentId（disabled 已放开）', async () => {
    render(<CategoriesManagePage />);

    // 等待列表渲染
    await waitFor(() => expect(screen.getByText('餐饮食品')).toBeInTheDocument());

    // 一级列表第一项（c1）的编辑按钮
    const editButtons = screen.getAllByTitle('编辑');
    fireEvent.click(editButtons[0]);

    // 编辑弹窗打开，名称为"餐饮食品"（系统分类）
    const nameInput = document.getElementById('cat-name') as HTMLInputElement;
    expect(nameInput).not.toBeNull();
    // 关键：系统分类名称输入框不应被 disabled（放开限制）
    expect(nameInput.disabled).toBe(false);

    fireEvent.change(nameInput, { target: { value: '饮食管理' } });
    expect(nameInput.value).toBe('饮食管理');

    // 点击保存
    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => expect(h.updateCategory).toHaveBeenCalled());
    const [idArg, payloadArg] = h.updateCategory.mock.calls[0] as [string, Record<string, unknown>];
    expect(idArg).toBe('c1');
    expect(payloadArg.name).toBe('饮食管理');
    // 沿用上次修复：更新不应带 parentId（否则触发 forbidNonWhitelisted 400）
    expect('parentId' in payloadArg).toBe(false);
  });

  it('② 二级网格拖拽（指针）保存：reorderCategories 收到的 items 顺序与拖拽后一致', async () => {
    // jsdom 无布局，给可拖拽节点伪造递增的纵向位置，使碰撞检测可计算"over"
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect');
    rectSpy.mockImplementation(function (this: Element) {
      const nodes = Array.from(document.querySelectorAll('[data-draggable]'));
      const i = nodes.indexOf(this as Element);
      if (i >= 0) {
        const y = i * 50;
        return {
          x: 0, y, top: y, bottom: y + 40, left: 0, right: 40, width: 40, height: 40, toJSON() {},
        } as unknown as DOMRect;
      }
      return { x: 0, y: 0, top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, toJSON() {} } as unknown as DOMRect;
    });

    render(<CategoriesManagePage />);
    await waitFor(() => expect(screen.getByText('三餐')).toBeInTheDocument());

    // 所有"拖拽排序"手柄：左列表2个(c1,c2) + 右网格3个(s1,s2,s3)
    const handles = screen.getAllByTitle('拖拽排序');
    expect(handles.length).toBe(5);
    const s1Handle = handles[2]; // 右网格第一个：s1(三餐)，对应 data-draggable 节点 index 2

    // 模拟指针拖拽：按下 -> 移动到 s2 位置(y≈150) -> 抬起
    // dnd-kit PointerSensor 要求 isPrimary 与 button===0 才会激活；move/up 需 buttons:1，且监听挂在 document 上
    fireEvent.pointerDown(s1Handle, { clientX: 20, clientY: 100, pointerId: 1, isPrimary: true, button: 0, bubbles: true });
    fireEvent.pointerMove(document, { clientX: 20, clientY: 125, pointerId: 1, isPrimary: true, button: 0, buttons: 1, bubbles: true });
    fireEvent.pointerMove(document, { clientX: 20, clientY: 155, pointerId: 1, isPrimary: true, button: 0, buttons: 1, bubbles: true });
    fireEvent.pointerUp(document, { clientX: 20, clientY: 155, pointerId: 1, isPrimary: true, button: 0, buttons: 1, bubbles: true });

    await waitFor(() => expect(h.reorderCategories).toHaveBeenCalled());
    // reorderCategories(familyId, { items })
    const callArgs = h.reorderCategories.mock.calls[0] as [string, { items: Array<{ id: string; sortOrder: number }> }];
    const items = callArgs[1].items;
    expect(callArgs[0]).toBe('fam1');
    // 原顺序 s1,s2,s3 -> 拖拽 s1 下移一位后应为 s2,s1,s3
    expect(items.map((i) => i.id)).toEqual(['s2', 's1', 's3']);
    expect(items.map((i) => i.sortOrder)).toEqual([0, 1, 2]);

    rectSpy.mockRestore();
  });
});

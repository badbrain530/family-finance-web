import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

/**
 * 回归测试：分类编辑保存 400 问题（parentId 泄漏）
 *
 * 根因：编辑分类时 handleSaveForm 复用了 CreateCategoryRequest 的 payload，
 * 里面包含 parentId；后端 UpdateCategoryDto 未声明该字段，被 ValidationPipe 的
 * forbidNonWhitelisted 拦截返回 400，导致所有分类都无法修改（创建能成功）。
 *
 * 修复：编辑分支改为构造不含 parentId 的 Partial<CreateCategoryRequest>
 * （仅 name/icon/color）再传给 updateCategory。
 *
 * 本测试拦截 category.service.updateCategory，断言编辑保存时传入的 body：
 *   1) 不含 parentId；
 *   2) 仅含 name/icon/color。
 *
 * 同时验证 UX 增强：编辑「系统分类」时名称输入框被禁用并给出提示。
 */

const h = vi.hoisted(() => ({
  mockGetCategories: vi.fn(),
  mockUpdateCategory: vi.fn(),
  mockCreateCategory: vi.fn(),
  mockInitCategories: vi.fn(),
  mockDeleteCategory: vi.fn(),
  mockGetCurrentFamily: vi.fn(),
  mockToast: vi.fn(),
}));

vi.mock('@/services/family.service', () => ({
  getCurrentFamily: h.mockGetCurrentFamily,
}));
vi.mock('@/services/category.service', () => ({
  getCategories: h.mockGetCategories,
  updateCategory: h.mockUpdateCategory,
  createCategory: h.mockCreateCategory,
  initCategories: h.mockInitCategories,
  deleteCategory: h.mockDeleteCategory,
}));
vi.mock('@/components/ui/toaster', () => ({
  useToast: () => ({ toast: h.mockToast }),
}));

import { CategoriesManagePage } from './CategoriesManagePage';

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

const systemChild = {
  id: 'c-sys',
  familyId: 'family-1',
  parentId: 'p1',
  name: '系统外卖',
  icon: 'Utensils',
  color: '#111111',
  sortOrder: 1,
  isSystem: true,
  createdAt: '',
};

const customChild = {
  id: 'c-custom',
  familyId: 'family-1',
  parentId: 'p1',
  name: '自定义打车',
  icon: 'Car',
  color: '#222222',
  sortOrder: 2,
  isSystem: false,
  createdAt: '',
};

const parentCategory = {
  id: 'p1',
  familyId: 'family-1',
  parentId: null,
  name: '餐饮',
  icon: 'Utensils',
  color: '#000000',
  sortOrder: 1,
  isSystem: true,
  createdAt: '',
  children: [systemChild, customChild],
};

describe('CategoriesManagePage 回归：编辑分类不应发送 parentId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.mockGetCurrentFamily.mockResolvedValue(mockFamily);
    h.mockGetCategories.mockResolvedValue([parentCategory]);
    h.mockUpdateCategory.mockResolvedValue({ ...customChild });
    h.mockCreateCategory.mockResolvedValue({});
    h.mockInitCategories.mockResolvedValue({ success: true, count: 0 });
    h.mockDeleteCategory.mockResolvedValue({ success: true });
  });

  it('编辑自定义分类保存时，body 不含 parentId，仅含 name/icon/color', async () => {
    render(<CategoriesManagePage />);

    // 等待分类树加载完成（右侧二级分类网格标题出现）
    await waitFor(() => screen.getByText('餐饮 · 二级分类'));

    // 找到所有“编辑”按钮，点击自定义分类（第二个）
    const editButtons = screen.getAllByTitle('编辑');
    expect(editButtons.length).toBe(2);
    fireEvent.click(editButtons[1]);

    // 弹窗打开（标题为“编辑分类”）
    expect(await screen.findByText('编辑分类')).toBeInTheDocument();

    // 点击保存
    const saveBtn = screen.getByRole('button', { name: '保存' });
    fireEvent.click(saveBtn);

    // updateCategory 应被调用，且 body 不含 parentId
    await waitFor(() => expect(h.mockUpdateCategory).toHaveBeenCalled());
    const [calledId, payload] = h.mockUpdateCategory.mock.calls[0];
    expect(calledId).toBe('c-custom');
    expect(payload.parentId).toBeUndefined();
    expect(payload).toMatchObject({
      name: '自定义打车',
      icon: 'Car',
      color: '#222222',
    });
    // 不应携带任何多余字段
    expect(Object.keys(payload).sort()).toEqual(['color', 'icon', 'name']);
  });

  it('编辑系统分类时，名称输入框被禁用并有提示', async () => {
    render(<CategoriesManagePage />);
    await waitFor(() => screen.getByText('餐饮 · 二级分类'));

    const editButtons = screen.getAllByTitle('编辑');
    fireEvent.click(editButtons[0]); // 系统分类（第一个）

    expect(await screen.findByText('编辑分类')).toBeInTheDocument();
    const nameInput = screen.getByPlaceholderText('如：外卖、打车出行') as HTMLInputElement;
    expect(nameInput.disabled).toBe(true);
    expect(screen.getByText('系统分类名称不可修改')).toBeInTheDocument();
  });
});

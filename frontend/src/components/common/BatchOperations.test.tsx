import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BatchOperations } from './BatchOperations';

/**
 * 回归测试：批量操作栏已移除「修改分类」按钮（批量修改分类入口）。
 * 修复后多选时批量栏只剩：全选 / 批量删除 / 取消。
 */
describe('BatchOperations - 移除批量修改分类（Bug 修复）', () => {
  it('① 未选中任何项时渲染 null（不显示批量栏）', () => {
    const { container } = render(
      <BatchOperations
        selectedCount={0}
        onBatchDelete={vi.fn()}
        onSelectAll={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('② 选中后仅显示 全选/批量删除/取消，且不再显示「修改分类」', () => {
    const onBatchDelete = vi.fn();
    const onSelectAll = vi.fn();
    const onClearSelection = vi.fn();

    render(
      <BatchOperations
        selectedCount={3}
        onBatchDelete={onBatchDelete}
        onSelectAll={onSelectAll}
        onClearSelection={onClearSelection}
        isAllSelected={false}
      />,
    );

    // 选中计数（文案为「已选择 3 项」，计数在嵌套 span 中，用正则匹配）
    expect(screen.getByText(/已选择/)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    // 仅保留的三个按钮
    expect(screen.getByRole('button', { name: /全选/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /批量删除/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /取消/ })).toBeInTheDocument();

    // 关键回归：不再有「修改分类」按钮 / 文案
    expect(screen.queryByText('修改分类')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /修改分类/ })).not.toBeInTheDocument();

    // 回调正确触发
    fireEvent.click(screen.getByRole('button', { name: /批量删除/ }));
    expect(onBatchDelete).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /全选/ }));
    expect(onSelectAll).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /取消/ }));
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it('③ 组件签名已不含 onBatchClassify，也不再渲染 Tag 图标按钮', () => {
    // 不传 onBatchClassify 也能正常渲染，证明该 prop 已从接口移除
    render(
      <BatchOperations
        selectedCount={1}
        onBatchDelete={vi.fn()}
        onSelectAll={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );
    // 没有任何「修改分类」相关按钮 / 文案
    expect(screen.queryByRole('button', { name: /修改分类/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/修改分类/)).not.toBeInTheDocument();
  });
});

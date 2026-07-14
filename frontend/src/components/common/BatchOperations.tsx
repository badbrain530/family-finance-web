import { Trash2, X, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * 批量操作工具栏组件 (W-03)
 * 选中交易后显示，仅支持批量删除
 */
interface BatchOperationsProps {
  /** 已选中的条目数 */
  selectedCount: number;
  /** 批量删除回调 */
  onBatchDelete: () => void;
  /** 全选回调 */
  onSelectAll: () => void;
  /** 取消选择回调 */
  onClearSelection: () => void;
  /** 是否全选 */
  isAllSelected?: boolean;
  className?: string;
}

export function BatchOperations({
  selectedCount,
  onBatchDelete,
  onSelectAll,
  onClearSelection,
  isAllSelected = false,
  className,
}: BatchOperationsProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 bg-primary-50 rounded-lg border border-primary-100',
        'animate-slide-down',
        className,
      )}
    >
      {/* 选中计数 */}
      <span className="text-sm font-medium text-primary-700">
        已选择 <span className="font-bold">{selectedCount}</span> 项
      </span>

      <div className="flex-1" />

      {/* 全选按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onSelectAll}
        className="text-primary-600"
      >
        <CheckSquare size={14} />
        {isAllSelected ? '取消全选' : '全选'}
      </Button>

      {/* 批量删除 */}
      <Button
        variant="destructive"
        size="sm"
        onClick={onBatchDelete}
      >
        <Trash2 size={14} />
        批量删除
      </Button>

      {/* 取消选择 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        className="text-text-secondary"
      >
        <X size={14} />
        取消
      </Button>
    </div>
  );
}

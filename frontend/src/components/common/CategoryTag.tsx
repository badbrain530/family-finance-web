import { cn } from '@/lib/utils';
import type { Category } from '@/types/transaction';

/**
 * 分类标签组件
 * 显示分类名称和颜色圆点
 */
interface CategoryTagProps {
  category: Pick<Category, 'name' | 'color'> | null | undefined;
  className?: string;
  size?: 'sm' | 'md';
}

export function CategoryTag({ category, className, size = 'sm' }: CategoryTagProps) {
  if (!category) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-text-tertiary',
          size === 'sm' ? 'text-xs' : 'text-sm',
          className,
        )}
      >
        <span className="w-2 h-2 rounded-full bg-[rgba(148,163,184,0.4)]" />
        未分类
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium',
        size === 'sm' ? 'text-xs' : 'text-sm',
        className,
      )}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: category.color || '#00C896' }}
      />
      {category.name}
    </span>
  );
}

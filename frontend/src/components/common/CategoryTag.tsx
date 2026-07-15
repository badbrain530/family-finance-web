import { cn } from '@/lib/utils';
import type { Category } from '@/types/transaction';
import { CategoryIcon } from '@/components/common/CategoryIcon';

/**
 * 分类标签组件
 * 显示分类图标（内联 SVG）+ 颜色圆点 + 名称
 */
interface CategoryTagProps {
  category: Pick<Category, 'name' | 'color' | 'icon'> | null | undefined;
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
      {category.icon && (
        <CategoryIcon iconKey={category.icon} size={12} color={category.color ?? '#3B82F6'} />
      )}
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: category.color || '#3B82F6' }}
      />
      {category.name}
    </span>
  );
}

/**
 * 分类图标统一渲染组件。
 * 接收图标 key（见 categoryIconMeta.ts 的 CategoryIconKey），
 * 通过 getCategoryIcon 解析为对应内联 SVG glyph 并渲染。
 *
 * 颜色策略：
 * - 传入 color 时，设置 style={{ color }}（glyph 以 currentColor 描边，从而着色）
 * - 不传 color 时，继承父级 currentColor（例如配合文字 / 背景色使用）
 */
import { getCategoryIcon } from '@/features/categories/categoryIcons';

export interface CategoryIconProps {
  /** 图标 key，例如 'dining' / 'transport' / 'other'（见 CategoryIconKey） */
  iconKey: string;
  size?: number;
  color?: string;
  className?: string;
}

export function CategoryIcon({
  iconKey,
  size = 20,
  color,
  className,
}: CategoryIconProps): JSX.Element {
  const Glyph = getCategoryIcon(iconKey);
  if (color) {
    return <Glyph size={size} color={color} className={className} />;
  }
  return <Glyph size={size} className={className} />;
}

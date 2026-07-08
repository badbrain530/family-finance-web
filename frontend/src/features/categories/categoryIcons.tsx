/**
 * 25 个分类图标的内联 SVG 组件（手写 JSX）。
 *
 * 所有 glyph 统一通过 GlyphShell 复用公共 <svg> 属性，
 * 每个 glyph 仅书写各自的内部图元（来源：category-icons.html / gen_icons.py）。
 *
 * 设计约束（与设计 token 一致）：
 * - viewBox 0 0 48 48
 * - stroke=currentColor、strokeWidth 2.5、圆角端点 / 连接
 * - 单个来源配色：颜色由使用方通过 color 传入，对应 categoryIconMeta.ts 的 ICON_COLOR
 *
 * 双轨解析：getCategoryIcon 既支持 25 个设计师 key，也支持任意 lucide 图标名，
 * 未命中时回退到 lucide Circle，避免白屏。
 */
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { ALL_ICON_KEYS, type CategoryIconKey } from './categoryIconMeta';

/** 图标组件公共入参 */
export interface GlyphProps {
  size?: number;
  color?: string;
  className?: string;
}

/** 分类图标组件类型（设计师新 glyph） */
export type CategoryGlyph = (props: GlyphProps) => JSX.Element;

/** 公共 SVG 外壳：统一 48×48 坐标、currentColor 描边、2.5 圆角 */
interface GlyphShellProps extends GlyphProps {
  children: ReactNode;
}

function GlyphShell({
  size = 24,
  color,
  className,
  children,
}: GlyphShellProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={color ? { color } : undefined}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const Dining: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <path d="M9 27h30a15 15 0 0 1-30 0Z" />
    <path d="M20 18c0-3 4-3 4-6" />
    <path d="M28 18c0-3 4-3 4-6" />
  </GlyphShell>
);

const Shopping: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <path d="M14 18h20l-2 22H16z" />
    <path d="M19 18v-3a5 5 0 0 1 10 0v3" />
  </GlyphShell>
);

const Transport: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <path d="M8 31h32v-8l-5-8H13l-5 8z" />
    <path d="M15 23l3-5h12l3 5z" />
    <circle cx="17" cy="31" r="3.5" />
    <circle cx="31" cy="31" r="3.5" />
  </GlyphShell>
);

const Home: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <path d="M24 13 10 25h4v13h20V25h4z" />
  </GlyphShell>
);

const Entertainment: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <rect x="10" y="20" width="28" height="16" rx="8" />
    <path d="M19 26h-4M17 24v4" />
    <circle cx="31" cy="25" r="1.6" />
    <circle cx="34" cy="28" r="1.6" />
  </GlyphShell>
);

const Medical: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <rect x="14" y="14" width="20" height="20" rx="5" />
    <path d="M24 18v12M18 24h12" />
  </GlyphShell>
);

const Education: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <path d="M24 16 40 23 24 30 8 23z" />
    <path d="M40 23v9" />
    <circle cx="40" cy="33" r="2" />
    <path d="M18 30v6" />
  </GlyphShell>
);

const Travel: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <rect x="13" y="18" width="22" height="20" rx="4" />
    <path d="M20 18v-3a4 4 0 0 1 8 0v3" />
    <path d="M13 26h22" />
  </GlyphShell>
);

const Communication: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <path d="M10 14h28a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H22l-7 6v-6H10a3 3 0 0 1-3-3V17a3 3 0 0 1 3-3z" />
  </GlyphShell>
);

const Salary: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <rect x="9" y="16" width="30" height="20" rx="4" />
    <path d="M9 22h30" />
    <circle cx="33" cy="26" r="2" />
    <rect x="14" y="11" width="14" height="9" rx="2" />
  </GlyphShell>
);

const Bonus: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <rect x="12" y="22" width="24" height="16" rx="3" />
    <rect x="10" y="18" width="28" height="6" rx="2" />
    <path d="M24 18v20" />
    <path d="M24 18c-4-6-10-4-10 0 0 3 5 4 10 0zM24 18c4-6 10-4 10 0 0 3-5 4-10 0z" />
  </GlyphShell>
);

const Investment: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <path d="M10 38h32" />
    <path d="M12 38V12" />
    <path d="M14 32l8-8 6 5 10-12" />
    <path d="M30 17h10v10" />
  </GlyphShell>
);

const Finance: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <ellipse cx="24" cy="27" rx="14" ry="10" />
    <path d="M20 18h8" />
    <circle cx="36" cy="27" r="4" />
    <path d="M19 36v4M29 36v4" />
    <circle cx="14" cy="15" r="3" />
  </GlyphShell>
);

const Redpacket: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <rect x="12" y="14" width="24" height="26" rx="4" />
    <path d="M12 20c5-4 11-4 12 0s7 4 12 0" />
    <circle cx="24" cy="26" r="5" />
    <path d="M22 26h4M24 24v4" />
  </GlyphShell>
);

const Pet: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <ellipse cx="24" cy="30" rx="8" ry="6.5" />
    <circle cx="15" cy="22" r="3.5" />
    <circle cx="22" cy="18" r="3.5" />
    <circle cx="30" cy="18" r="3.5" />
    <circle cx="37" cy="22" r="3.5" />
  </GlyphShell>
);

const Favor: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <path d="M24 34 13 23a7 7 0 0 1 11-8 7 7 0 0 1 11 8z" />
  </GlyphShell>
);

const Digital: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <rect x="12" y="14" width="24" height="16" rx="2" />
    <path d="M9 33h30l2 4H7z" />
  </GlyphShell>
);

const Clothing: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <path d="M16 16 12 20l4 4v14h16V24l4 4 4-4-4-4c-2 3-5 4-8 4s-6-1-8-4z" />
  </GlyphShell>
);

const Beauty: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <path d="M21 14c0-3 6-3 6 0v6H21z" />
    <rect x="20" y="20" width="8" height="14" rx="2" />
    <rect x="18" y="34" width="12" height="4" rx="2" />
  </GlyphShell>
);

const Sports: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <circle cx="24" cy="24" r="13" />
    <path d="M11 24h26" />
    <path d="M24 11v26" />
    <path d="M14 14c6 6 14 6 20 0" />
    <path d="M14 34c6-6 14-6 20 0" />
  </GlyphShell>
);

const Book: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <path d="M12 14c4-2 9-2 12 0v22c-3-2-8-2-12 0z" />
    <path d="M36 14c-4-2-9-2-12 0v22c3-2 8-2 12 0z" />
    <path d="M24 14v22" />
  </GlyphShell>
);

const Subscription: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <path d="M24 13a8 8 0 0 0-8 8v6l-3 4h22l-3-4v-6a8 8 0 0 0-8-8z" />
    <path d="M21 36a3 3 0 0 0 6 0" />
  </GlyphShell>
);

const Insurance: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <path d="M24 12 37 17v9c0 9-7 13-13 16-6-3-13-7-13-16v-9z" />
    <path d="M19 25l4 4 8-9" />
  </GlyphShell>
);

const Tax: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <path d="M14 12h20v26l-3-2-3 2-3-2-3 2-3-2-3 2z" />
    <path d="M18 19h12M18 25h12M18 31h8" />
  </GlyphShell>
);

const Other: CategoryGlyph = ({ size, color, className }) => (
  <GlyphShell size={size} color={color} className={className}>
    <circle cx="24" cy="24" r="14" />
    <circle cx="17" cy="24" r="2.4" fill="currentColor" stroke="none" />
    <circle cx="24" cy="24" r="2.4" fill="currentColor" stroke="none" />
    <circle cx="31" cy="24" r="2.4" fill="currentColor" stroke="none" />
  </GlyphShell>
);

/** 25 个分类图标组件注册表（key → 渲染组件） */
export const categoryIcons: Record<CategoryIconKey, CategoryGlyph> = {
  dining: Dining,
  shopping: Shopping,
  transport: Transport,
  home: Home,
  entertainment: Entertainment,
  medical: Medical,
  education: Education,
  travel: Travel,
  communication: Communication,
  salary: Salary,
  bonus: Bonus,
  investment: Investment,
  finance: Finance,
  redpacket: Redpacket,
  pet: Pet,
  favor: Favor,
  digital: Digital,
  clothing: Clothing,
  beauty: Beauty,
  sports: Sports,
  book: Book,
  subscription: Subscription,
  insurance: Insurance,
  tax: Tax,
  other: Other,
};

/**
 * 双轨解析分类图标：
 *   1. 命中 25 个设计师 key（CategoryIconKey）→ 返回对应新 glyph
 *   2. 否则视为 lucide 图标名 → 从 lucide-react 动态取同名组件
 *   3. 均未命中 → 回退到 lucide Circle，避免白屏
 *
 * 返回类型统一为 LucideIcon（设计师 glyph 做类型断言以兼容），
 * 调用方（CategoryIcon / 列表渲染）无需区分来源，统一使用 size/color/className。
 */
export function getCategoryIcon(key: string): LucideIcon {
  // 1. 设计师新图标 key
  if (ALL_ICON_KEYS.includes(key as CategoryIconKey)) {
    return categoryIcons[key as CategoryIconKey] as unknown as LucideIcon;
  }
  // 2. 经典 lucide 图标名（兼容 kebab-case 与 bare-lowercase 历史/未来数据，统一归一化为 PascalCase）
  //    - 含连字符：逐段首字母大写（utensils 不适用，shopping-bag -> ShoppingBag）
  //    - 无连字符：首字母直接大写（utensils -> Utensils，对已是 PascalCase 的 Wallet/Zap 幂等）
  const pascalKey = key.includes('-')
    ? key.split('-').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('')
    : key.charAt(0).toUpperCase() + key.slice(1);
  const LucideComp = (LucideIcons as Record<string, unknown>)[pascalKey];
  // lucide 图标在 React 中多数是 forwardRef/memo 对象（typeof === 'object'），
  // 兼容函数组件与对象组件两种形态，命中有效组件即返回，否则进入 Circle 兜底
  if (
    LucideComp &&
    (typeof LucideComp === 'function' ||
      (typeof LucideComp === 'object' &&
        (LucideComp as { $$typeof?: unknown }).$$typeof != null))
  ) {
    return LucideComp as LucideIcon;
  }
  // 3. 兜底，避免白屏
  if (import.meta.env.DEV) {
    console.warn('[categoryIcon] unknown icon key, fallback to Circle:', key);
  }
  return LucideIcons.Circle;
}

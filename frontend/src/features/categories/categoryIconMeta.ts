/**
 * 分类图标元数据（图标 key / 设计 token 配色）
 *
 * 这是前端分类图标系统的「单一来源」：
 * - CategoryIconKey：25 个分类图标的唯一 key（设计师新图标）
 * - ICON_COLOR：每个 key 对应的设计 token 十六进制色
 * - ALL_ICON_KEYS：选择器全量 25 key（顺序即呈现顺序）
 *
 * 图标的 SVG 图元见 categoryIcons.tsx；配色与 key 在此集中维护，
 * 确保「图标 key ↔ 配色」一一对应（单一来源决策）。
 *
 * 双轨说明：分类的 icon 字段既可存设计师 key（如 'dining'），
 * 也可存 lucide 图标名（如 'utensils'）。无论哪种，均经由
 * categoryIcons.tsx 的 getCategoryIcon 解析为对应渲染组件，
 * 调用方无需关心底层来源。
 */

/** 25 个分类图标 key 联合类型 */
export type CategoryIconKey =
  | 'dining'
  | 'shopping'
  | 'transport'
  | 'home'
  | 'entertainment'
  | 'medical'
  | 'education'
  | 'travel'
  | 'communication'
  | 'salary'
  | 'bonus'
  | 'investment'
  | 'finance'
  | 'redpacket'
  | 'pet'
  | 'favor'
  | 'digital'
  | 'clothing'
  | 'beauty'
  | 'sports'
  | 'book'
  | 'subscription'
  | 'insurance'
  | 'tax'
  | 'other';

/** 每个图标 key 对应的设计 token 配色（hex） */
export const ICON_COLOR: Record<CategoryIconKey, string> = {
  dining: '#F97316',
  shopping: '#EC4899',
  transport: '#0EA5E9',
  home: '#8B5CF6',
  entertainment: '#F43F5E',
  medical: '#10B981',
  education: '#14B8A6',
  travel: '#06B6D4',
  communication: '#6366F1',
  salary: '#22C55E',
  bonus: '#EAB308',
  investment: '#3B82F6',
  finance: '#2563EB',
  redpacket: '#EF4444',
  pet: '#F59E0B',
  favor: '#F472B6',
  digital: '#64748B',
  clothing: '#A855F7',
  beauty: '#DB2777',
  sports: '#16A34A',
  book: '#7C3AED',
  subscription: '#4F46E5',
  insurance: '#0891B2',
  tax: '#E11D48',
  other: '#94A3B8',
};

/** 选择器全量 key（顺序即呈现顺序） */
export const ALL_ICON_KEYS: CategoryIconKey[] = [
  'dining',
  'shopping',
  'transport',
  'home',
  'entertainment',
  'medical',
  'education',
  'travel',
  'communication',
  'salary',
  'bonus',
  'investment',
  'finance',
  'redpacket',
  'pet',
  'favor',
  'digital',
  'clothing',
  'beauty',
  'sports',
  'book',
  'subscription',
  'insurance',
  'tax',
  'other',
];

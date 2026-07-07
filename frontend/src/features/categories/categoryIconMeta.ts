/**
 * 分类图标元数据（图标 key / 设计 token 配色 / 兼容映射）
 *
 * 这是前端分类图标系统的「单一来源」：
 * - CategoryIconKey：25 个分类图标的唯一 key
 * - ICON_COLOR：每个 key 对应的设计 token 十六进制色
 * - ALL_ICON_KEYS：选择器全量 25 key（顺序即呈现顺序）
 * - LEGACY_ICON_MAP：旧 lucide 图标名 → 新 key 的兼容映射
 *
 * 图标的 SVG 图元见 categoryIcons.tsx；配色与 key 在此集中维护，
 * 确保「图标 key ↔ 配色」一一对应（单一来源决策）。
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

/**
 * 旧 lucide 图标名 → 新 key 的兼容映射。
 * 用于从数据库 / 旧数据中读到的旧 lucide 名也能正确渲染对应分类图标。
 * 未在此列出的旧名会被 getCategoryIcon 回退到 other。
 */
export const LEGACY_ICON_MAP: Record<string, CategoryIconKey> = {
  // 餐饮
  Utensils: 'dining',
  Wheat: 'dining',
  Apple: 'dining',
  Drumstick: 'dining',
  Coffee: 'dining',
  Wine: 'dining',
  // 购物 / 日用
  ShoppingBag: 'shopping',
  ShoppingCart: 'shopping',
  Scissors: 'shopping',
  Sparkles: 'beauty', // 旧「个人护理」曾用 sparkles
  Sofa: 'home', // 旧「家居装饰」曾用 sofa
  // 衣着
  Shirt: 'clothing',
  Footprints: 'clothing',
  Glasses: 'clothing',
  // 居住
  Home: 'home',
  Building: 'home',
  Building2: 'home',
  Zap: 'home',
  Wrench: 'home',
  // 交通通信
  Car: 'transport',
  CarFront: 'transport',
  Bus: 'transport',
  Bike: 'transport',
  Phone: 'communication',
  Mail: 'communication',
  // 教育文化娱乐
  BookOpen: 'education',
  GraduationCap: 'education',
  Film: 'entertainment',
  Gamepad: 'entertainment',
  Plane: 'travel',
  MapPin: 'travel',
  Map: 'travel',
  Dumbbell: 'sports',
  // 医疗保健
  HeartPulse: 'medical',
  Stethoscope: 'medical',
  Pill: 'medical',
  // 收入
  Banknote: 'salary',
  Clock: 'salary',
  Wallet: 'salary',
  Gift: 'redpacket',
  TrendingUp: 'investment',
  Percent: 'investment',
  PiggyBank: 'investment',
  ChartLine: 'finance',
  CreditCard: 'finance',
  Store: 'other',
  Handshake: 'other',
  Briefcase: 'other',
  // 其他
  MoreHorizontal: 'other',
  ArrowLeftRight: 'other',
  Package: 'other',
  Plus: 'other',
  RotateCcw: 'other',
  Tag: 'other',
  Users: 'other',
  Shield: 'insurance',
  Smartphone: 'digital',
};

/**
 * 默认分类体系
 * 对齐国标8大类，每类含子分类
 * 用于Prisma seed和前端分类选择器初始化
 *
 * 图标字段说明：icon 存储的是「图标 key」（见 features/categories/categoryIconMeta.ts 的
 * CategoryIconKey，例如 'dining' / 'transport' / 'other'），而非旧版 lucide 图标名；
 * color 为对应设计 token 十六进制色（ICON_COLOR）。图标 key 与配色一一对应（单一来源）。
 */

export interface DefaultCategory {
  name: string;
  /** 图标 key（见 CategoryIconKey），如 'dining' */
  icon: string;
  /** 设计 token 十六进制色 */
  color: string;
  children?: Array<{
    name: string;
    icon: string;
    color: string;
  }>;
}

/** 支出分类（国标8大类） */
export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategory[] = [
  {
    name: '食品烟酒',
    icon: 'dining',
    color: '#F97316',
    children: [
      { name: '米面粮油', icon: 'dining', color: '#F97316' },
      { name: '蔬菜水果', icon: 'dining', color: '#F97316' },
      { name: '肉禽蛋奶', icon: 'dining', color: '#F97316' },
      { name: '在外就餐', icon: 'dining', color: '#F97316' },
      { name: '零食饮料', icon: 'dining', color: '#F97316' },
      { name: '烟酒', icon: 'dining', color: '#F97316' },
    ],
  },
  {
    name: '衣着',
    icon: 'clothing',
    color: '#A855F7',
    children: [
      { name: '服装', icon: 'clothing', color: '#A855F7' },
      { name: '鞋帽', icon: 'clothing', color: '#A855F7' },
      { name: '配饰', icon: 'clothing', color: '#A855F7' },
    ],
  },
  {
    name: '居住',
    icon: 'home',
    color: '#8B5CF6',
    children: [
      { name: '房租', icon: 'home', color: '#8B5CF6' },
      { name: '水电燃气', icon: 'home', color: '#8B5CF6' },
      { name: '物业费', icon: 'home', color: '#8B5CF6' },
      { name: '房屋维修', icon: 'home', color: '#8B5CF6' },
    ],
  },
  {
    name: '生活用品及服务',
    icon: 'shopping',
    color: '#EC4899',
    children: [
      { name: '日用杂品', icon: 'shopping', color: '#EC4899' },
      { name: '个人护理', icon: 'beauty', color: '#DB2777' },
      { name: '家居装饰', icon: 'home', color: '#8B5CF6' },
    ],
  },
  {
    name: '交通通信',
    icon: 'transport',
    color: '#0EA5E9',
    children: [
      { name: '公共交通', icon: 'transport', color: '#0EA5E9' },
      { name: '出租车/网约车', icon: 'transport', color: '#0EA5E9' },
      { name: '私家车', icon: 'transport', color: '#0EA5E9' },
      { name: '通讯费', icon: 'communication', color: '#6366F1' },
      { name: '邮递', icon: 'communication', color: '#6366F1' },
    ],
  },
  {
    name: '教育文化娱乐',
    icon: 'education',
    color: '#14B8A6',
    children: [
      { name: '教育', icon: 'education', color: '#14B8A6' },
      { name: '文化娱乐', icon: 'entertainment', color: '#F43F5E' },
      { name: '旅游', icon: 'travel', color: '#06B6D4' },
      { name: '体育', icon: 'sports', color: '#16A34A' },
    ],
  },
  {
    name: '医疗保健',
    icon: 'medical',
    color: '#10B981',
    children: [
      { name: '门诊', icon: 'medical', color: '#10B981' },
      { name: '药品', icon: 'medical', color: '#10B981' },
      { name: '保健', icon: 'medical', color: '#10B981' },
    ],
  },
  {
    name: '其他用品和服务',
    icon: 'other',
    color: '#94A3B8',
    children: [
      { name: '转账', icon: 'other', color: '#94A3B8' },
      { name: '红包礼金', icon: 'other', color: '#94A3B8' },
      { name: '其他', icon: 'other', color: '#94A3B8' },
    ],
  },
];

/** 收入分类 */
export const DEFAULT_INCOME_CATEGORIES: DefaultCategory[] = [
  {
    name: '工资收入',
    icon: 'salary',
    color: '#22C55E',
    children: [
      { name: '基本工资', icon: 'salary', color: '#22C55E' },
      { name: '奖金', icon: 'bonus', color: '#EAB308' },
      { name: '加班费', icon: 'salary', color: '#22C55E' },
    ],
  },
  {
    name: '经营收入',
    icon: 'other',
    color: '#94A3B8',
    children: [
      { name: '销售收入', icon: 'other', color: '#94A3B8' },
      { name: '服务收入', icon: 'other', color: '#94A3B8' },
    ],
  },
  {
    name: '投资收益',
    icon: 'investment',
    color: '#3B82F6',
    children: [
      { name: '利息', icon: 'investment', color: '#3B82F6' },
      { name: '股息', icon: 'investment', color: '#3B82F6' },
      { name: '基金收益', icon: 'finance', color: '#2563EB' },
    ],
  },
  {
    name: '其他收入',
    icon: 'other',
    color: '#94A3B8',
    children: [
      { name: '退款', icon: 'other', color: '#94A3B8' },
      { name: '红包', icon: 'redpacket', color: '#EF4444' },
      { name: '其他', icon: 'other', color: '#94A3B8' },
    ],
  },
];

/** 获取所有默认分类（支出+收入） */
export function getAllDefaultCategories(): DefaultCategory[] {
  return [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES];
}

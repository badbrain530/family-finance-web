/**
 * 默认分类体系
 * 对齐国标8大类，每类含子分类
 * 用于Prisma seed和前端分类选择器初始化
 */

export interface DefaultCategory {
  name: string;
  icon: string;
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
    icon: 'Utensils',
    color: '#FF6B6B',
    children: [
      { name: '米面粮油', icon: 'Wheat', color: '#FF6B6B' },
      { name: '蔬菜水果', icon: 'Apple', color: '#FF8E8E' },
      { name: '肉禽蛋奶', icon: 'Drumstick', color: '#FF7676' },
      { name: '在外就餐', icon: 'Utensils', color: '#FF5252' },
      { name: '零食饮料', icon: 'Coffee', color: '#FF9999' },
      { name: '烟酒', icon: 'Wine', color: '#E05050' },
    ],
  },
  {
    name: '衣着',
    icon: 'Shirt',
    color: '#4ECDC4',
    children: [
      { name: '服装', icon: 'Shirt', color: '#4ECDC4' },
      { name: '鞋帽', icon: 'Footprints', color: '#45B7AA' },
      { name: '配饰', icon: 'Glasses', color: '#5DD5CD' },
    ],
  },
  {
    name: '居住',
    icon: 'Home',
    color: '#45B7D1',
    children: [
      { name: '房租', icon: 'Building', color: '#45B7D1' },
      { name: '水电燃气', icon: 'Zap', color: '#52C5DE' },
      { name: '物业费', icon: 'Building2', color: '#3DA8C4' },
      { name: '房屋维修', icon: 'Wrench', color: '#5ACFE8' },
    ],
  },
  {
    name: '生活用品及服务',
    icon: 'ShoppingBag',
    color: '#96CEB4',
    children: [
      { name: '日用杂品', icon: 'ShoppingCart', color: '#96CEB4' },
      { name: '个人护理', icon: 'Sparkles', color: '#84BFA6' },
      { name: '家居装饰', icon: 'Sofa', color: '#A8D8C2' },
    ],
  },
  {
    name: '交通通信',
    icon: 'Car',
    color: '#FFEAA7',
    children: [
      { name: '公共交通', icon: 'Bus', color: '#FFEAA7' },
      { name: '出租车/网约车', icon: 'Car', color: '#FDD663' },
      { name: '私家车', icon: 'CarFront', color: '#F5CE5A' },
      { name: '通讯费', icon: 'Phone', color: '#FFE066' },
      { name: '邮递', icon: 'Package', color: '#FFDF85' },
    ],
  },
  {
    name: '教育文化娱乐',
    icon: 'BookOpen',
    color: '#DDA0DD',
    children: [
      { name: '教育', icon: 'GraduationCap', color: '#DDA0DD' },
      { name: '文化娱乐', icon: 'Film', color: '#C48EC4' },
      { name: '旅游', icon: 'Plane', color: '#E2B4E2' },
      { name: '体育', icon: 'Dumbbell', color: '#CFA0CF' },
    ],
  },
  {
    name: '医疗保健',
    icon: 'HeartPulse',
    color: '#FF8C94',
    children: [
      { name: '门诊', icon: 'Stethoscope', color: '#FF8C94' },
      { name: '药品', icon: 'Pill', color: '#FF7782' },
      { name: '保健', icon: 'HeartPulse', color: '#FFA0A8' },
    ],
  },
  {
    name: '其他用品和服务',
    icon: 'MoreHorizontal',
    color: '#A8A8A8',
    children: [
      { name: '转账', icon: 'ArrowLeftRight', color: '#A8A8A8' },
      { name: '红包礼金', icon: 'Gift', color: '#B4B4B4' },
      { name: '其他', icon: 'MoreHorizontal', color: '#969696' },
    ],
  },
];

/** 收入分类 */
export const DEFAULT_INCOME_CATEGORIES: DefaultCategory[] = [
  {
    name: '工资收入',
    icon: 'Banknote',
    color: '#00C896',
    children: [
      { name: '基本工资', icon: 'Banknote', color: '#00C896' },
      { name: '奖金', icon: 'Gift', color: '#1FE8B0' },
      { name: '加班费', icon: 'Clock', color: '#00A87E' },
    ],
  },
  {
    name: '经营收入',
    icon: 'Store',
    color: '#008866',
    children: [
      { name: '销售收入', icon: 'ShoppingCart', color: '#008866' },
      { name: '服务收入', icon: 'Handshake', color: '#006E52' },
    ],
  },
  {
    name: '投资收益',
    icon: 'TrendingUp',
    color: '#005841',
    children: [
      { name: '利息', icon: 'Percent', color: '#005841' },
      { name: '股息', icon: 'TrendingUp', color: '#003D2C' },
      { name: '基金收益', icon: 'ChartLine', color: '#006E52' },
    ],
  },
  {
    name: '其他收入',
    icon: 'Plus',
    color: '#00A87E',
    children: [
      { name: '退款', icon: 'RotateCcw', color: '#00A87E' },
      { name: '红包', icon: 'Gift', color: '#1FE8B0' },
      { name: '其他', icon: 'Plus', color: '#008866' },
    ],
  },
];

/** 获取所有默认分类（支出+收入） */
export function getAllDefaultCategories(): DefaultCategory[] {
  return [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES];
}

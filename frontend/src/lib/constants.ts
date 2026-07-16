/**
 * 应用常量定义
 * 包含API地址、路由路径、应用配置等
 */

// API基础地址
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// WebSocket地址
export const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

// 应用名称
export const APP_NAME = import.meta.env.VITE_APP_NAME || '家庭财务管家';

// 路由路径常量
export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  TRANSACTIONS: '/transactions',
  ACCOUNTS: '/accounts',
  FAMILY: '/family',
  BUDGET: '/budget',
  CATEGORIES: '/categories',
  REPORTS: '/reports',
  NOTIFICATIONS: '/notifications',
  SETTINGS: '/settings',
  AGENT_ACCESS: '/settings/agent-access',
  REIMBURSEMENTS: '/reimbursements',
  BONDS: '/bonds',
  AMORTIZATIONS: '/amortizations',
  ADVANCES: '/advances',
} as const;

/**
 * 侧边栏导航项
 * group 字段用于侧边栏分组（同组项在标题下聚合渲染）。
 * 债务/债券 组（垫付/待摊/债券/待报销）为本板块（T01/T04）新增。
 */
export const NAV_ITEMS = [
  { path: ROUTES.DASHBOARD, label: '仪表盘', icon: 'LayoutDashboard', group: '总览' },
  { path: ROUTES.TRANSACTIONS, label: '交易管理', icon: 'ArrowLeftRight', group: '记账' },
  { path: ROUTES.ACCOUNTS, label: '账户', icon: 'Wallet', group: '记账' },
  { path: ROUTES.FAMILY, label: '家庭协同', icon: 'Users', group: '协同' },
  { path: ROUTES.BUDGET, label: '预算管理', icon: 'PiggyBank', group: '规划' },
  { path: ROUTES.CATEGORIES, label: '分类', icon: 'Tags', group: '规划' },
  { path: ROUTES.REPORTS, label: '财务月报', icon: 'FileText', group: '规划' },
  { path: ROUTES.NOTIFICATIONS, label: '通知中心', icon: 'Bell', group: '协同' },
  { path: ROUTES.REIMBURSEMENTS, label: '待报销', icon: 'Receipt', group: '债务/债券' },
  { path: ROUTES.BONDS, label: '债券', icon: 'Landmark', group: '债务/债券' },
  { path: ROUTES.AMORTIZATIONS, label: '待摊预付', icon: 'Layers', group: '债务/债券' },
  { path: ROUTES.ADVANCES, label: '垫付', icon: 'ArrowUpRight', group: '债务/债券' },
  { path: ROUTES.SETTINGS, label: '设置', icon: 'Settings', group: '系统' },
  { path: ROUTES.AGENT_ACCESS, label: '智能体接入', icon: 'Bot', group: '智能体' },
] as const;

// 移动端底部导航项（4个Tab）
export const MOBILE_NAV_ITEMS = [
  { path: ROUTES.DASHBOARD, label: '首页', icon: 'Home' },
  { path: ROUTES.TRANSACTIONS, label: '交易', icon: 'ArrowLeftRight' },
  { path: ROUTES.BUDGET, label: '预算', icon: 'Wallet' },
  { path: ROUTES.SETTINGS, label: '我的', icon: 'User' },
] as const;

// 分页默认值
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// Token存储Key
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'ff_access_token',
  REFRESH_TOKEN: 'ff_refresh_token',
  USER_INFO: 'ff_user_info',
  THEME: 'ff_theme',
  SIDEBAR_COLLAPSED: 'ff_sidebar_collapsed',
} as const;

// API错误码
export const ERROR_CODES = {
  SUCCESS: 0,
  UNKNOWN_ERROR: 1000,
  VALIDATION_ERROR: 1001,
  UNAUTHORIZED: 1002,
  FORBIDDEN: 1003,
  NOT_FOUND: 1004,
  CONFLICT: 1005,
  RATE_LIMITED: 1006,
  INTERNAL_ERROR: 2000,
  DATABASE_ERROR: 2001,
  REDIS_ERROR: 2002,
  AI_SERVICE_ERROR: 3000,
  LLM_API_ERROR: 3001,
  IMPORT_PARSE_ERROR: 4000,
  FILE_UPLOAD_ERROR: 4001,
} as const;

// 大额支出阈值（元）
export const LARGE_EXPENSE_THRESHOLD = 1000;

// 撤销记账超时时间（毫秒）
export const UNDO_TIMEOUT = 5 * 60 * 1000; // 5分钟

// 月份名称
export const MONTH_NAMES = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
] as const;

// ==================== 账户类型元数据（唯一映射源） ====================
import { AccountType } from '@/types/account';

/**
 * 账户类型 ↔ 中文名/图标/颜色 统一映射
 * icon 为 lucide-react 图标名，前端在组件内映射为具体组件
 */
export const ACCOUNT_TYPE_META: Record<
  AccountType,
  { label: string; icon: string; color: string }
> = {
  DEBIT: { label: '储蓄卡', icon: 'CreditCard', color: '#3B82F6' },
  CREDIT: { label: '信用卡', icon: 'CreditCard', color: '#F59E0B' },
  INVESTMENT: { label: '投资', icon: 'TrendingUp', color: '#6366F1' },
  CASH: { label: '现金', icon: 'Banknote', color: '#10B981' },
  E_WALLET: { label: '钱包', icon: 'Wallet', color: '#0EA5E9' },
  VIRTUAL: { label: '虚拟', icon: 'Sparkles', color: '#A855F7' },
};

/** 账户类型顺序（用于分组展示） */
export const ACCOUNT_TYPE_ORDER: AccountType[] = [
  AccountType.DEBIT,
  AccountType.CREDIT,
  AccountType.INVESTMENT,
  AccountType.CASH,
  AccountType.E_WALLET,
  AccountType.VIRTUAL,
];

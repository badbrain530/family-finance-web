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
  IMPORT: '/import',
  FAMILY: '/family',
  BUDGET: '/budget',
  REPORTS: '/reports',
  NOTIFICATIONS: '/notifications',
  SETTINGS: '/settings',
} as const;

// 侧边栏导航项
export const NAV_ITEMS = [
  { path: ROUTES.DASHBOARD, label: '仪表盘', icon: 'LayoutDashboard' },
  { path: ROUTES.TRANSACTIONS, label: '交易管理', icon: 'ArrowLeftRight' },
  { path: ROUTES.IMPORT, label: '账单导入', icon: 'Upload' },
  { path: ROUTES.FAMILY, label: '家庭协同', icon: 'Users' },
  { path: ROUTES.BUDGET, label: '预算管理', icon: 'Wallet' },
  { path: ROUTES.REPORTS, label: '财务月报', icon: 'FileText' },
  { path: ROUTES.NOTIFICATIONS, label: '通知中心', icon: 'Bell' },
  { path: ROUTES.SETTINGS, label: '设置', icon: 'Settings' },
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

import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuthStore } from '@/store/authStore';
import type { ReactNode } from 'react';

// 懒加载页面组件
import { lazy, Suspense } from 'react';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

// 认证页面
const LoginPage = lazy(() => import('@/features/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage').then(m => ({ default: m.RegisterPage })));

// Onboarding引导
const OnboardingPage = lazy(() => import('@/features/onboarding/OnboardingPage').then(m => ({ default: m.OnboardingPage })));

// 仪表盘
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));

// 交易管理
const TransactionListPage = lazy(() => import('@/features/transactions/TransactionListPage').then(m => ({ default: m.TransactionListPage })));

// 家庭协同
const FamilyLedgerPage = lazy(() => import('@/features/family/FamilyLedgerPage').then(m => ({ default: m.FamilyLedgerPage })));

// 预算管理
const BudgetPage = lazy(() => import('@/features/budget/BudgetPage').then(m => ({ default: m.BudgetPage })));

// AI财务洞察月报
const MonthlyReportPage = lazy(() => import('@/features/report/MonthlyReportPage').then(m => ({ default: m.MonthlyReportPage })));

// 设置
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));

// 账户总览
const AccountsPage = lazy(() => import('@/features/accounts/AccountsPage').then(m => ({ default: m.AccountsPage })));

// 分类管理
const CategoriesManagePage = lazy(() => import('@/features/categories/CategoriesManagePage').then(m => ({ default: m.CategoriesManagePage })));

// 通知中心
const NotificationsPage = lazy(() => import('@/features/notifications/NotificationsPage').then(m => ({ default: m.NotificationsPage })));

/**
 * 受保护路由包装器
 * 未登录用户重定向到登录页
 */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/**
 * 认证路由守卫
 * 已登录用户访问登录/注册页时重定向到仪表盘
 */
function AuthRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/**
 * 应用根组件 - 路由配置
 * 路由结构按架构文档定义：
 * - /login, /register - 认证页面（无需登录）
 * - /onboarding - 新用户引导（需要登录）
 * - /dashboard - 仪表盘
 * - /transactions - 交易管理
 * - /accounts - 账户总览
 * - /family - 家庭协同
 * - /budget - 预算管理
 * - /categories - 分类管理
 * - /reports - AI财务洞察月报
 * - /notifications - 通知中心
 * - /settings - 设置
 */
export default function App() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Routes>
        {/* 认证路由 - 已登录用户自动跳转仪表盘 */}
        <Route path="/login" element={
          <AuthRoute><LoginPage /></AuthRoute>
        } />
        <Route path="/register" element={
          <AuthRoute><RegisterPage /></AuthRoute>
        } />

        {/* Onboarding引导 - 需要登录但不需要AppLayout */}
        <Route path="/onboarding" element={
          <ProtectedRoute><OnboardingPage /></ProtectedRoute>
        } />

        {/* 受保护路由 - 需要登录后访问，使用AppLayout */}
        <Route path="/" element={
          <ProtectedRoute><AppLayout /></ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionListPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="family" element={<FamilyLedgerPage />} />
          <Route path="budget" element={<BudgetPage />} />
          <Route path="categories" element={<CategoriesManagePage />} />
          <Route path="reports" element={<MonthlyReportPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* 404 重定向到仪表盘 */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

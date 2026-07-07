import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { FloatingQuickRecordButton } from './FloatingQuickRecordButton';
import { QuickRecordModal } from '@/features/transactions/QuickRecordModal';
import { CommandPalette } from '@/components/common/CommandPalette';
import { Toaster } from '@/components/ui/toaster';
import { useGlobalHotkeys } from '@/hooks/useHotkeys';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { getUnreadCount } from '@/services/notification.service';
import { useEffect } from 'react';

/**
 * 应用主布局组件
 * Web端：240px侧边栏 + 顶部栏 + 主内容区
 * Mobile端：状态栏 + 内容区 + 底部胶囊导航4tab
 *
 * 集成全局组件：
 * - QuickRecordModal（Ctrl+K 快捷记账浮层）
 * - CommandPalette（Ctrl+Shift+K 命令面板）
 * - Toaster（全局Toast通知）
 * - useGlobalHotkeys（全局快捷键监听）
 */
export function AppLayout() {
  const { sidebarCollapsed, theme } = useUIStore();
  const { isAuthenticated } = useAuthStore();
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  // 注册全局快捷键
  useGlobalHotkeys();

  // 主题变化时同步到 <html> 的 class（驱动 .dark CSS 变量换肤）
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // 登录后同步未读通知数，驱动顶栏铃铛红点
  useEffect(() => {
    if (!isAuthenticated) return;
    getUnreadCount()
      .then((res) => setUnreadCount(res.count))
      .catch(() => {
        /* 忽略：通知模块未初始化不影响主流程 */
      });
  }, [isAuthenticated, setUnreadCount]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 桌面端侧边栏 */}
      <Sidebar collapsed={sidebarCollapsed} />

      {/* 主内容区 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 顶部栏 */}
        <Header />

        {/* 页面内容 */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* 移动端底部导航 */}
        <MobileNav />
      </div>

      {/* 移动端快捷记账悬浮按钮 */}
      <FloatingQuickRecordButton />

      {/* 全局浮层组件 */}
      <QuickRecordModal />
      <CommandPalette />
      <Toaster />
    </div>
  );
}

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Upload,
  Users,
  Wallet,
  FileText,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { NAV_ITEMS, APP_NAME } from '@/lib/constants';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

// 图标映射
const iconMap: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  LayoutDashboard,
  ArrowLeftRight,
  Upload,
  Users,
  Wallet,
  FileText,
  Bell,
  Settings,
};

interface SidebarProps {
  collapsed: boolean;
}

/**
 * 左侧导航栏
 * Web端：240px宽度，可折叠
 * 包含应用Logo + 导航项 + 折叠按钮
 */
export function Sidebar({ collapsed }: SidebarProps) {
  const { toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col bg-surface border-r border-border transition-all duration-200',
        collapsed ? 'w-16' : 'w-sidebar',
      )}
    >
      {/* Logo区域 */}
      <div className="flex items-center h-header px-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Wallet size={18} className="text-white" />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold text-text-primary whitespace-nowrap">
              {APP_NAME}
            </span>
          )}
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.icon] || LayoutDashboard;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn('nav-item', isActive && 'active', collapsed && 'justify-center px-2')
              }
              title={collapsed ? item.label : undefined}
            >
              <Icon size={20} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* 折叠按钮 */}
      <div className="p-2 border-t border-border shrink-0">
        <button
          onClick={toggleSidebar}
          className="flex items-center justify-center w-full p-2 rounded-lg text-text-secondary hover:bg-primary-50 hover:text-primary-600 transition-colors"
          title={collapsed ? '展开侧边栏' : '折叠侧边栏'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </aside>
  );
}

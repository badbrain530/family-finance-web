import { useState } from 'react';
import { Bell, Search, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/lib/utils';

/**
 * 顶部栏
 * 包含：搜索框、通知图标（未读数）、用户头像
 */
export function Header() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { unreadCount } = useNotificationStore();
  const { toggleSidebar, setQuickRecordOpen } = useUIStore();
  const [searchValue, setSearchValue] = useState('');

  return (
    <header className="flex items-center justify-between h-header px-4 md:px-6 bg-surface border-b border-border shrink-0">
      {/* 左侧：移动端菜单按钮 + 搜索框 */}
      <div className="flex items-center gap-3 flex-1">
        <button
          onClick={toggleSidebar}
          className="md:hidden p-2 rounded-lg hover:bg-primary-50 transition-colors"
        >
          <Menu size={20} className="text-text-secondary" />
        </button>

        {/* 搜索框 */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="搜索交易、分类..."
            className="input-base pl-9 h-9"
          />
        </div>
      </div>

      {/* 右侧：快捷记账按钮 + 通知 + 用户 */}
      <div className="flex items-center gap-3">
        {/* 快捷记账按钮 (Ctrl+K) */}
        <button
          onClick={() => setQuickRecordOpen(true)}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-600 transition-colors"
        >
          <span>快捷记账</span>
          <kbd className="px-1.5 py-0.5 text-xs bg-white/20 rounded">Ctrl+K</kbd>
        </button>

        {/* 通知图标 */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 rounded-lg hover:bg-primary-50 transition-colors"
        >
          <Bell size={20} className="text-text-secondary" />
          {unreadCount > 0 && (
            <span
              className={cn(
                'absolute top-1 right-1 min-w-4 h-4 px-1',
                'flex items-center justify-center',
                'text-2xs font-bold text-white bg-expense rounded-full',
              )}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* 用户头像 */}
        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2 p-1 pr-2 rounded-lg hover:bg-primary-50 transition-colors"
        >
          {user?.avatar ? (
            <img src={user.avatar} alt={user.nickname} className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-sm font-medium text-primary-600">
                {user?.nickname?.charAt(0) || '?'}
              </span>
            </div>
          )}
          <span className="hidden md:block text-sm font-medium text-text-primary">
            {user?.nickname || '未登录'}
          </span>
        </button>
      </div>
    </header>
  );
}

import { NavLink } from 'react-router-dom';
import { Home, ArrowLeftRight, Wallet, User } from 'lucide-react';
import { MOBILE_NAV_ITEMS } from '@/lib/constants';
import { cn } from '@/lib/utils';

// 图标映射
const iconMap: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  Home,
  ArrowLeftRight,
  Wallet,
  User,
};

/**
 * 移动端底部胶囊导航
 * 4个Tab：首页 / 交易 / 预算 / 我的
 */
export function MobileNav() {
  return (
    <nav className="md:hidden flex items-center justify-around h-mobile-nav bg-surface border-t border-border px-2 shrink-0">
      {MOBILE_NAV_ITEMS.map((item) => {
        const Icon = iconMap[item.icon] || Home;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-full transition-colors',
                isActive ? 'text-primary' : 'text-text-tertiary',
              )
            }
          >
            <Icon size={22} />
            <span className="text-2xs font-medium">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

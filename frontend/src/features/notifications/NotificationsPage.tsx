import { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  CreditCard,
  FileText,
  Users,
  Bell,
  CheckCheck,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from '@/services/notification.service';
import { useToast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { useNotificationStore } from '@/store/notificationStore';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { Notification } from '@/types/notification';

/**
 * 通知类型元信息（以"后端大写原始字符串"为键，解决前后端大小写不一致，设计 §8.7）
 * 后端 NotificationType 为大写（BUDGET_WARNING...），前端枚举为小写，
 * 这里统一用 toUpperCase 后的字符串查表，避免匹配失效。
 */
const NOTIFICATION_META: Record<
  string,
  { label: string; icon: LucideIcon; color: string; route: string }
> = {
  BUDGET_WARNING: { label: '预算预警', icon: AlertTriangle, color: '#F59E0B', route: '/budget' },
  BUDGET_EXCEEDED: { label: '预算超支', icon: AlertTriangle, color: '#EF4444', route: '/budget' },
  BUDGET_SUCCESS: { label: '预算达成', icon: CheckCircle, color: '#16A34A', route: '/budget' },
  LARGE_EXPENSE: { label: '大额支出', icon: CreditCard, color: '#DC2626', route: '/transactions' },
  MONTHLY_REPORT: { label: '月报生成', icon: FileText, color: '#6366F1', route: '/reports' },
  FAMILY_MEMBER_JOIN: { label: '成员加入', icon: Users, color: '#3B82F6', route: '/family' },
};

/** 路由修正：后端 actionUrl 与前端路由差异 */
function resolveRoute(actionUrl?: string, fallback = '/dashboard'): string {
  if (!actionUrl) return fallback;
  const map: Record<string, string> = {
    '/report': '/reports',
    '/reports': '/reports',
    '/family': '/family',
    '/budget': '/budget',
    '/transactions': '/transactions',
    '/dashboard': '/dashboard',
  };
  return map[actionUrl] || actionUrl;
}

/**
 * 通知中心页
 * - 列表 + 未读筛选 Tab
 * - 单条已读 / 全部已读
 * - 类型图标与跳转（data.actionUrl）
 * - 红点联动 notificationStore
 */
export function NotificationsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const storeMarkAsRead = useNotificationStore((s) => s.markAsRead);
  const storeMarkAllAsRead = useNotificationStore((s) => s.markAllAsRead);

  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = async (onlyUnread = false) => {
    setLoading(true);
    try {
      const res = await getNotifications({
        unreadOnly: onlyUnread || undefined,
        pageSize: 50,
      });
      setItems(res.items);
      setUnread(res.unreadCount);
      setUnreadCount(res.unreadCount);
    } catch (err: any) {
      toast({ title: '加载通知失败', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(filter === 'unread');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // 切换筛选时改变列表
  const visibleItems = useMemo(() => items, [items]);

  const handleItemClick = async (n: Notification) => {
    if (!n.isRead) {
      try {
        await markAsRead(n.id);
        storeMarkAsRead(n.id);
        setUnread((c) => Math.max(0, c - 1));
        setItems((list) => list.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      } catch {
        /* 静默 */
      }
    }
    // 跳转
    const route = resolveRoute(n.data?.actionUrl, NOTIFICATION_META[n.type.toUpperCase()]?.route || '/dashboard');
    navigate(route);
  };

  const handleMarkAll = async () => {
    try {
      await markAllAsRead();
      storeMarkAllAsRead();
      setUnread(0);
      setItems((list) => list.map((x) => ({ ...x, isRead: true })));
      toast({ title: '已全部标记为已读', variant: 'success' });
    } catch (err: any) {
      toast({ title: '操作失败', description: err?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="page-container max-w-3xl">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">通知中心</h1>
          <p className="text-text-secondary mt-1">
            未读 {unreadCount} 条
          </p>
        </div>
        <Button variant="outline" onClick={handleMarkAll} disabled={unreadCount === 0}>
          <CheckCheck size={16} className="mr-1" />
          全部已读
        </Button>
      </div>

      {/* 筛选 Tab */}
      <div className="flex gap-1 mb-4 bg-[rgba(11,18,32,0.4)] w-fit p-1 rounded-lg">
        {([
          { key: 'all', label: '全部' },
          { key: 'unread', label: '未读' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              filter === tab.key
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="text-text-secondary">加载中...</div>
      ) : visibleItems.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mb-3">
            <Bell size={26} className="text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary">暂无通知</h3>
          <p className="text-text-secondary mt-1">有新的提醒时会显示在这里</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((n) => {
            const meta = NOTIFICATION_META[n.type.toUpperCase()] || {
              label: '通知',
              icon: Bell,
              color: '#64748B',
              route: '/dashboard',
            };
            const Icon = meta.icon;
            return (
              <button
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={cn(
                  'w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-colors',
                  n.isRead
                    ? 'border-border bg-surface'
                    : 'border-primary/30 bg-primary-50/40',
                )}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: meta.color + '20' }}
                >
                  <Icon size={20} style={{ color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary truncate">{n.title}</span>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-text-secondary mt-0.5 line-clamp-2">{n.content}</p>
                  <div className="text-xs text-text-tertiary mt-1">
                    {meta.label} · {formatRelativeTime(n.createdAt)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

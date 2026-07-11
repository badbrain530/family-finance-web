import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, TrendingUp, ArrowLeftRight, Wallet, FileText, Settings, Plus } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * 命令面板组件 (Ctrl+Shift+K)
 * 快速导航和操作入口
 */

interface CommandItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  action: () => void;
  group: '导航' | '操作' | '设置';
  shortcut?: string;
}

export function CommandPalette() {
  const navigate = useNavigate();
  const { commandPaletteOpen, setCommandPaletteOpen, setQuickRecordOpen } = useUIStore();
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  // 命令列表
  const commands: CommandItem[] = [
    { id: 'nav-dashboard', label: '仪表盘', icon: TrendingUp, action: () => navigate(ROUTES.DASHBOARD), group: '导航' },
    { id: 'nav-transactions', label: '交易管理', icon: ArrowLeftRight, action: () => navigate(ROUTES.TRANSACTIONS), group: '导航' },
    { id: 'nav-family', label: '家庭协同', icon: Wallet, action: () => navigate(ROUTES.FAMILY), group: '导航' },
    { id: 'nav-budget', label: '预算管理', icon: Wallet, action: () => navigate(ROUTES.BUDGET), group: '导航' },
    { id: 'nav-report', label: '财务月报', icon: FileText, action: () => navigate(ROUTES.REPORTS), group: '导航' },
    { id: 'nav-settings', label: '设置', icon: Settings, action: () => navigate(ROUTES.SETTINGS), group: '设置' },
    { id: 'op-quick-record', label: '快捷记账', icon: Plus, action: () => { setQuickRecordOpen(true); setCommandPaletteOpen(false); }, group: '操作', shortcut: 'Ctrl+K' },
  ];

  // 过滤命令
  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(search.toLowerCase()),
  );

  // 重置选中索引
  useEffect(() => {
    setActiveIndex(0);
  }, [search]);

  // 键盘导航
  useEffect(() => {
    if (!commandPaletteOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filteredCommands[activeIndex];
        if (cmd) {
          cmd.action();
          setCommandPaletteOpen(false);
          setSearch('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, filteredCommands, activeIndex, setCommandPaletteOpen]);

  // 关闭时清空搜索
  useEffect(() => {
    if (!commandPaletteOpen) {
      setSearch('');
    }
  }, [commandPaletteOpen]);

  // 按分组组织命令
  const groupedCommands = filteredCommands.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = [];
    acc[cmd.group].push(cmd);
    return acc;
  }, {});

  let flatIndex = -1;

  return (
    <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <DialogContent className="max-w-xl p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">命令面板</DialogTitle>

        {/* 搜索输入框 */}
        <div className="flex items-center gap-2 px-4 border-b border-border">
          <Search size={18} className="text-text-tertiary shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索命令或页面..."
            autoFocus
            className="flex-1 h-14 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-tertiary"
          />
          <kbd className="px-1.5 py-0.5 text-xs bg-primary-50 text-primary-600 rounded font-mono">
            ESC
          </kbd>
        </div>

        {/* 命令列表 */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-tertiary">
              未找到匹配的命令
            </div>
          ) : (
            Object.entries(groupedCommands).map(([group, items]) => (
              <div key={group} className="mb-2">
                <div className="px-2 py-1 text-xs font-semibold text-text-tertiary">
                  {group}
                </div>
                {items.map((cmd) => {
                  flatIndex++;
                  const isActive = flatIndex === activeIndex;
                  const Icon = cmd.icon;
                  const currentFlatIndex = flatIndex;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        cmd.action();
                        setCommandPaletteOpen(false);
                        setSearch('');
                      }}
                      onMouseEnter={() => setActiveIndex(currentFlatIndex)}
                      className={cn(
                        'flex items-center gap-3 w-full px-2 py-2 rounded-lg text-sm transition-colors',
                        isActive ? 'bg-primary-50 text-primary-600' : 'text-text-primary hover:bg-primary-50/50',
                      )}
                    >
                      <Icon size={16} className="shrink-0" />
                      <span className="flex-1 text-left">{cmd.label}</span>
                      {cmd.shortcut && (
                        <kbd className="px-1.5 py-0.5 text-xs bg-primary-50 text-primary-600 rounded font-mono">
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Utensils,
  Car,
  Home,
  ShoppingBag,
  BookOpen,
  HeartPulse,
  Zap,
  Send,
  Loader2,
  Sparkles,
  Wallet,
  Plus,
} from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectSeparator,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store/uiStore';
import { useToast } from '@/components/ui/toaster';
import { quickRecord } from '@/services/transaction.service';
import { getAccounts } from '@/services/account.service';
import { getCurrentFamily } from '@/services/family.service';
import { getLedgers, createLedger } from '@/services/ledger.service';
import { LedgerType, type Family, type Ledger } from '@/types/family';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { TransactionType } from '@/types/transaction';
import type { Account } from '@/types/account';

/**
 * 快捷记账浮层 (W-01, P0)
 * Ctrl+K 唤起
 * 支持自然语言输入（"午餐35元"）
 * 大字号金额输入，6类分类网格卡片
 */

// 快速分类配置
const QUICK_CATEGORIES = [
  { id: 'food', name: '餐饮', icon: Utensils, color: '#FF6B6B' },
  { id: 'transport', name: '交通', icon: Car, color: '#FDD663' },
  { id: 'housing', name: '居住', icon: Home, color: '#45B7D1' },
  { id: 'shopping', name: '购物', icon: ShoppingBag, color: '#96CEB4' },
  { id: 'education', name: '教育', icon: BookOpen, color: '#DDA0DD' },
  { id: 'health', name: '医疗', icon: HeartPulse, color: '#FF8C94' },
];

// 自然语言解析示例
const NL_EXAMPLES = [
  '午餐35元',
  '打车18块',
  '工资到账18000',
  '超市购物128.5',
];

// 新建账本面板的特殊值（非真实账本ID）
const CREATE_LEDGER_ITEM_VALUE = '__create_ledger__';

export function QuickRecordModal() {
  const { quickRecordOpen, setQuickRecordOpen } = useUIStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [input, setInput] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [transactionType, setTransactionType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(formatDate(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [showNLHint, setShowNLHint] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // 账户（强制必选）
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);

  // 真实账本（Bug A：后端无 'current' 特殊解析，必须传真实账本ID）
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [ledgerId, setLedgerId] = useState('');
  // 账本面板模式：select=选择已有账本，create=在弹窗内直接新建账本
  const [ledgerPanelMode, setLedgerPanelMode] = useState<'select' | 'create'>('select');
  const [newLedgerName, setNewLedgerName] = useState('');
  const [creatingLedger, setCreatingLedger] = useState(false);
  const newLedgerInputRef = useRef<HTMLInputElement>(null);

  // 缓存当前家庭，避免重复请求 getCurrentFamily
  const familyRef = useRef<Family | null>(null);

  // 打开时自动聚焦 + 加载账户
  useEffect(() => {
    if (quickRecordOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      // 加载家庭账户列表（按 familyId 隔离）
      (async () => {
        try {
          const family = await getCurrentFamily();
          familyRef.current = family;
          const accs = await getAccounts(family.id);
          setAccounts(accs);
          // Bug A 修复：加载真实账本列表，挑选一个真实账本ID（优先共享账本）
          // 后端 getLedger 不会把 'current' 解析为默认账本，必须传真实 ID 否则记账 404
          const loaded = await getLedgers(family.id);
          setLedgers(loaded);
          // 无账本时直接进入"新建账本"面板，避免死路 toast
          if (loaded.length === 0) {
            setLedgerPanelMode('create');
            setLedgerId('');
            return;
          }
          const target = loaded.find((l) => l.type === LedgerType.SHARED) || loaded[0];
          setLedgerId(target?.id || '');
          setLedgerPanelMode('select');
        } catch (err: any) {
          toast({ title: '加载账户失败', description: err?.message, variant: 'destructive' });
        }
      })();
    } else {
      // 关闭时重置
      setInput('');
      setAmount('');
      setSelectedCategory(null);
      setTransactionType(TransactionType.EXPENSE);
      setNote('');
      setDate(formatDate(new Date(), 'yyyy-MM-dd'));
      setShowNLHint(true);
      setAccountId('');
      setLedgers([]);
      setLedgerId('');
      setLedgerPanelMode('select');
      setNewLedgerName('');
    }
  }, [quickRecordOpen]);

  // 监听输入变化，尝试解析自然语言
  const handleInputChange = (value: string) => {
    setInput(value);
    if (showNLHint) setShowNLHint(false);

    // 简单的前端解析逻辑（后端NLP做更精确的解析）
    const amountMatch = value.match(/(\d+(?:\.\d+)?)/);
    if (amountMatch) {
      setAmount(amountMatch[1]);
    }

    // 关键词匹配分类
    const lowerValue = value.toLowerCase();
    if (lowerValue.includes('饭') || lowerValue.includes('餐') || lowerValue.includes('吃') || lowerValue.includes('外卖')) {
      setSelectedCategory('food');
    } else if (lowerValue.includes('车') || lowerValue.includes('打车') || lowerValue.includes('地铁') || lowerValue.includes('公交')) {
      setSelectedCategory('transport');
    } else if (lowerValue.includes('房') || lowerValue.includes('租') || lowerValue.includes('水电')) {
      setSelectedCategory('housing');
    } else if (lowerValue.includes('买') || lowerValue.includes('购') || lowerValue.includes('超市')) {
      setSelectedCategory('shopping');
    }

    // 收入关键词
    if (lowerValue.includes('工资') || lowerValue.includes('收入') || lowerValue.includes('到账') || lowerValue.includes('退款')) {
      setTransactionType(TransactionType.INCOME);
    } else {
      setTransactionType(TransactionType.EXPENSE);
    }
  };

  // 在弹窗内直接创建账本：创建后自动选中并回到选择模式
  const handleCreateLedger = async () => {
    const family = familyRef.current;
    if (!family) {
      toast({
        title: '创建失败',
        description: '未获取到家庭信息，请关闭弹窗后重试',
        variant: 'destructive',
      });
      return;
    }
    const name = newLedgerName.trim() || '家庭账本';
    setCreatingLedger(true);
    try {
      const created = await createLedger(family.id, name, LedgerType.SHARED);
      setLedgers((prev) => [...prev, created]);
      setLedgerId(created.id);
      setNewLedgerName('');
      setLedgerPanelMode('select');
      toast({
        title: '账本已创建',
        description: `已创建「${created.name}」并自动选中，可继续记账`,
        variant: 'success',
      });
    } catch (err: any) {
      toast({
        title: '创建账本失败',
        description: err?.message || '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setCreatingLedger(false);
    }
  };

  // 新建账本输入框回车提交
  const handleNewLedgerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateLedger();
    }
  };

  // 提交快捷记账
  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: '请输入金额',
        description: '输入如"午餐35元"或直接填写金额',
        variant: 'destructive',
      });
      return;
    }

    if (!accountId) {
      toast({
        title: '请选择账户',
        description: '每笔交易都需要关联到具体账户',
        variant: 'destructive',
      });
      return;
    }

    // 账本守卫：无账本时引导在弹窗内创建，不再指向不存在的"账本管理"页
    if (!ledgerId) {
      if (ledgers.length > 0) {
        toast({
          title: '请选择账本',
          description: '请选择要记账的账本',
          variant: 'destructive',
        });
      } else {
        setLedgerPanelMode('create');
        setTimeout(() => newLedgerInputRef.current?.focus(), 100);
        toast({
          title: '还没有账本',
          description: '请在下方输入账本名称并点击"创建账本"，即可继续记账',
          variant: 'destructive',
        });
      }
      return;
    }

    setLoading(true);
    try {
      // 调用快捷记账API（使用真实账本ID，后端 getLedger 按 ID 精确查找）
      const result = await quickRecord({
        input: input || `${amount}元`,
        ledgerId,
        accountId,
      });

      toast({
        title: `已记：${result.transaction.category?.name || '交易'}`,
        description: `${transactionType === TransactionType.EXPENSE ? '-' : '+'}${formatCurrency(result.transaction.amount)} · 置信度${Math.round(result.confidence * 100)}%`,
        variant: 'success',
      });

      // 失效交易列表与账户缓存，确保"交易管理"与"账户视图"在记账后立即刷新
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });

      setQuickRecordOpen(false);
    } catch (err: any) {
      // Bug A 修复：API 失败时如实报错，不得伪造"已记成功"
      toast({
        title: '记账失败',
        description: err?.message || '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // 回车提交
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog open={quickRecordOpen} onOpenChange={setQuickRecordOpen}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
        <DialogTitle className="sr-only">快捷记账</DialogTitle>

        {/* 自然语言输入框 */}
        <div className="px-6 pt-6 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-primary" />
            <span className="text-sm font-medium text-text-secondary">输入文字，AI自动识别</span>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="试试输入：午餐35元"
            className="w-full h-12 text-base bg-transparent outline-none text-text-primary placeholder:text-text-tertiary border-b border-border focus:border-primary transition-colors"
          />

          {/* 自然语言提示 */}
          {showNLHint && (
            <div className="flex flex-wrap gap-2 mt-3">
              {NL_EXAMPLES.map((example) => (
                <button
                  key={example}
                  onClick={() => handleInputChange(example)}
                  className="px-2.5 py-1 text-xs rounded-full bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 金额显示区 */}
        <div className="px-6 py-4 bg-primary-50/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-tertiary">金额</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTransactionType(TransactionType.EXPENSE)}
                className={cn(
                  'px-2 py-0.5 text-xs rounded-full transition-colors',
                  transactionType === TransactionType.EXPENSE
                    ? 'bg-expense text-white'
                    : 'bg-surface text-text-tertiary hover:text-text-secondary',
                )}
              >
                支出
              </button>
              <button
                onClick={() => setTransactionType(TransactionType.INCOME)}
                className={cn(
                  'px-2 py-0.5 text-xs rounded-full transition-colors',
                  transactionType === TransactionType.INCOME
                    ? 'bg-income text-white'
                    : 'bg-surface text-text-tertiary hover:text-text-secondary',
                )}
              >
                收入
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-3xl font-bold tabular-nums',
              transactionType === TransactionType.EXPENSE ? 'text-expense' : 'text-income',
            )}>
              ¥
            </span>
            <input
              type="text"
              value={amount}
              onChange={(e) => {
                const val = e.target.value.replace(/[^\d.]/g, '');
                setAmount(val);
              }}
              onKeyDown={handleKeyDown}
              placeholder="0.00"
              className="flex-1 text-4xl font-bold bg-transparent outline-none tabular-nums placeholder:text-[rgba(148,163,184,0.4)]"
              style={{ color: transactionType === TransactionType.EXPENSE ? '#DC2626' : '#16A34A' }}
            />
          </div>
        </div>

        {/* 账户选择（强制必选） */}
        <div className="px-6 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={14} className="text-primary" />
            <span className="text-xs font-medium text-text-secondary">选择账户</span>
          </div>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="请选择账户" />
            </SelectTrigger>
            <SelectContent>
              {accounts.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-text-tertiary">暂无账户，请先添加</div>
              )}
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name}
                  {acc.lastFourDigits ? `（****${acc.lastFourDigits}）` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 账本选择（无账本时可在弹窗内直接创建，避免死路） */}
        <div className="px-6 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={14} className="text-primary" />
            <span className="text-xs font-medium text-text-secondary">选择账本</span>
          </div>

          {ledgerPanelMode === 'create' ? (
            <div className="rounded-lg border border-dashed border-primary/40 bg-primary-50/30 p-3">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={14} className="text-primary" />
                <span className="text-sm font-medium text-text-primary">
                  {ledgers.length > 0 ? '新建账本' : '还没有账本'}
                </span>
              </div>
              <p className="text-xs text-text-tertiary mb-3">
                创建账本后即可记账，账本用于归类家庭收支。
              </p>
              <div className="flex items-center gap-2">
                <Input
                  ref={newLedgerInputRef}
                  value={newLedgerName}
                  onChange={(e) => setNewLedgerName(e.target.value)}
                  onKeyDown={handleNewLedgerKeyDown}
                  placeholder="家庭账本"
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleCreateLedger}
                  disabled={creatingLedger}
                >
                  {creatingLedger ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  创建账本
                </Button>
              </div>
              {ledgers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLedgerPanelMode('select')}
                  className="mt-2 text-xs text-text-tertiary hover:text-primary-600 transition-colors"
                >
                  返回选择已有账本
                </button>
              )}
            </div>
          ) : (
            <Select value={ledgerId} onValueChange={setLedgerId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择账本" />
              </SelectTrigger>
              <SelectContent>
                {ledgers.map((ledger) => (
                  <SelectItem key={ledger.id} value={ledger.id}>
                    {ledger.name}
                    {ledger.type === LedgerType.PERSONAL ? '（个人）' : ''}
                  </SelectItem>
                ))}
                {ledgers.length > 0 && <SelectSeparator />}
                <SelectItem
                  value={CREATE_LEDGER_ITEM_VALUE}
                  onSelect={(e) => {
                    // 阻止切换实际账本值，改为打开"新建账本"面板
                    e.preventDefault();
                    setLedgerPanelMode('create');
                    setTimeout(() => newLedgerInputRef.current?.focus(), 100);
                  }}
                >
                  <span className="flex items-center gap-1 text-primary-600">
                    <Plus size={14} />
                    新建账本
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* 分类网格 */}
        <div className="px-6 py-4">
          <div className="text-xs text-text-tertiary mb-2">选择分类</div>
          <div className="grid grid-cols-6 gap-2">
            {QUICK_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all',
                    isSelected ? 'bg-primary-50 ring-2 ring-primary/20' : 'hover:bg-primary-50/50',
                  )}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: cat.color + '20' }}
                  >
                    <Icon size={18} style={{ color: cat.color }} />
                  </div>
                  <span className="text-xs text-text-secondary">{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 日期和备注 */}
        <div className="px-6 pb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-text-tertiary mb-1 block">日期</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs text-text-tertiary mb-1 block">备注</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="添加备注..."
              className="w-full h-9 px-3 text-sm bg-surface border border-border rounded-lg outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="flex items-center justify-between px-6 py-3 bg-surface border-t border-border">
          <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <Zap size={12} />
            <span>按 Enter 快速保存</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuickRecordOpen(false)}
              className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !amount}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-colors',
                'bg-primary hover:bg-primary-600',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              保存
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

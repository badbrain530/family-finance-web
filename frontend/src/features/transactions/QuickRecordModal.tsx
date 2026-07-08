import { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { useUIStore } from '@/store/uiStore';
import { useToast } from '@/components/ui/toaster';
import { quickRecord } from '@/services/transaction.service';
import { getAccounts } from '@/services/account.service';
import { getCurrentFamily } from '@/services/family.service';
import { getLedgers } from '@/services/ledger.service';
import { LedgerType } from '@/types/family';
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

export function QuickRecordModal() {
  const { quickRecordOpen, setQuickRecordOpen } = useUIStore();
  const { toast } = useToast();

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

  // 真实账本ID（Bug A：后端无 'current' 特殊解析，必须传真实账本ID）
  const [ledgerId, setLedgerId] = useState('');

  // 打开时自动聚焦 + 加载账户
  useEffect(() => {
    if (quickRecordOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      // 加载家庭账户列表（按 familyId 隔离）
      (async () => {
        try {
          const family = await getCurrentFamily();
          const accs = await getAccounts(family.id);
          setAccounts(accs);
          // Bug A 修复：加载真实账本列表，挑选一个真实账本ID（优先共享账本）
          // 后端 getLedger 不会把 'current' 解析为默认账本，必须传真实 ID 否则记账 404
          const ledgers = await getLedgers(family.id);
          const target = ledgers.find((l) => l.type === LedgerType.SHARED) || ledgers[0];
          setLedgerId(target?.id || '');
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
      setLedgerId('');
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

    if (!ledgerId) {
      toast({
        title: '未找到可用账本',
        description: '请先在账本管理中创建账本后再记账',
        variant: 'destructive',
      });
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

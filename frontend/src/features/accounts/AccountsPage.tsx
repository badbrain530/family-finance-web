import { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  TrendingUp,
  Banknote,
  Wallet,
  Sparkles,
  Plus,
  Pencil,
  PowerOff,
  Power,
  type LucideIcon,
} from 'lucide-react';
import { getCurrentFamily } from '@/services/family.service';
import { getAccounts } from '@/services/account.service';
import { useToast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { AccountFormDrawer } from './AccountFormDrawer';
import { AccountTransactionsDrawer } from './AccountTransactionsDrawer';
import { ACCOUNT_TYPE_META, ACCOUNT_TYPE_ORDER } from '@/lib/constants';
import { cn, formatCurrency } from '@/lib/utils';
import { AccountType } from '@/types/account';
import type { Account } from '@/types/account';
import type { Family } from '@/types/family';

/** 账户类型 → lucide 图标组件映射（按图标名字符串索引，与 ACCOUNT_TYPE_META.icon 对齐） */
const ACCOUNT_ICONS: Record<string, LucideIcon> = {
  CreditCard,
  TrendingUp,
  Banknote,
  Wallet,
  Sparkles,
};

/** 距还款日天数 */
function daysUntilDue(paymentDueDay: number | null): number | null {
  if (!paymentDueDay) return null;
  const now = new Date();
  let due = new Date(now.getFullYear(), now.getMonth(), paymentDueDay);
  if (due < now) due = new Date(now.getFullYear(), now.getMonth() + 1, paymentDueDay);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 账户总览页
 * - 顶部净资产汇总
 * - 按类型分组的账户卡片
 * - 新建/编辑/停用
 */
export function AccountsPage() {
  const { toast } = useToast();
  const [family, setFamily] = useState<Family | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  // 功能C：点击账户查看其下交易流水
  const [txAccount, setTxAccount] = useState<Account | null>(null);
  const [txOpen, setTxOpen] = useState(false);

  // 加载家庭与账户
  const load = async () => {
    setLoading(true);
    try {
      const fam = await getCurrentFamily();
      setFamily(fam);
      const list = await getAccounts(fam.id);
      setAccounts(list);
    } catch (err: any) {
      toast({ title: '加载账户失败', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 净资产 = 非信用卡余额求和 - 信用卡欠款求和（仅统计启用账户）
  const summary = useMemo(() => {
    const active = accounts.filter((a) => a.isActive);
    let net = 0;
    let assets = 0;
    let debt = 0;
    for (const a of active) {
      if (a.type === AccountType.CREDIT) {
        debt += a.balance;
        net -= a.balance;
      } else {
        assets += a.balance;
        net += a.balance;
      }
    }
    return { net, assets, debt };
  }, [accounts]);

  // 按类型分组
  const grouped = useMemo(() => {
    return ACCOUNT_TYPE_ORDER.map((type) => ({
      type,
      meta: ACCOUNT_TYPE_META[type],
      items: accounts.filter((a) => a.type === type),
    })).filter((g) => g.items.length > 0);
  }, [accounts]);

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  const openEdit = (acc: Account) => {
    setEditing(acc);
    setDrawerOpen(true);
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="text-text-secondary">加载中...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">账户</h1>
          <p className="text-text-secondary mt-1">管理你的储蓄卡、信用卡、投资与钱包</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} className="mr-1" />
          添加账户
        </Button>
      </div>

      {/* 净资产汇总卡片 */}
      <div className="card mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-sm text-text-secondary">净资产</div>
          <div className="text-3xl font-bold text-text-primary tabular-nums mt-1">
            {formatCurrency(summary.net)}
          </div>
        </div>
        <div className="flex gap-6">
          <div>
            <div className="text-xs text-text-tertiary">总资产</div>
            <div className="text-lg font-semibold text-income">{formatCurrency(summary.assets)}</div>
          </div>
          <div>
            <div className="text-xs text-text-tertiary">总负债</div>
            <div className="text-lg font-semibold text-expense">{formatCurrency(summary.debt)}</div>
          </div>
        </div>
      </div>

      {/* 空状态 */}
      {accounts.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mb-3">
            <Wallet size={26} className="text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary">还没有账户</h3>
          <p className="text-text-secondary mt-1 mb-4">添加你的第一个账户，开始管理资产</p>
          <Button onClick={openCreate}>
            <Plus size={16} className="mr-1" />
            添加账户
          </Button>
        </div>
      ) : (
        // 分组展示
        <div className="space-y-8">
          {grouped.map((group) => {
            const Icon = ACCOUNT_ICONS[group.meta.icon] || Wallet;
            return (
              <section key={group.type}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={18} style={{ color: group.meta.color }} />
                  <h2 className="text-base font-semibold text-text-primary">{group.meta.label}</h2>
                  <span className="text-xs text-text-tertiary">（{group.items.length}）</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.items.map((acc) => (
                    <AccountCard
                      key={acc.id}
                      account={acc}
                      onEdit={() => openEdit(acc)}
                      onView={() => {
                        setTxAccount(acc);
                        setTxOpen(true);
                      }}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* 新建/编辑抽屉 */}
      {family && (
        <AccountFormDrawer
          familyId={family.id}
          account={editing}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onSaved={load}
        />
      )}

      {/* 功能C：账户交易流水抽屉 */}
      <AccountTransactionsDrawer
        account={txAccount}
        open={txOpen}
        onOpenChange={setTxOpen}
      />
    </div>
  );
}

/** 单个账户卡片 */
function AccountCard({
  account,
  onEdit,
  onView,
}: {
  account: Account;
  onEdit: () => void;
  onView: () => void;
}) {
  const meta = ACCOUNT_TYPE_META[account.type];
  const Icon = ACCOUNT_ICONS[meta.icon] || Wallet;
  const subtitle =
    account.lastFourDigits
      ? `**** ${account.lastFourDigits}`
      : account.institution || account.platform || account.purpose || '';

  // 信用卡：展示可用额度 / 授信额度
  const isCredit = account.type === AccountType.CREDIT;
  const available = account.availableCredit ?? 0;
  const limit = account.creditLimit ?? 0;
  const usedPercent = limit > 0 ? Math.min(100, (account.balance / limit) * 100) : 0;
  const dueDays = daysUntilDue(account.paymentDueDay);

  return (
    <div
      onClick={onView}
      className={cn(
        'card relative group cursor-pointer transition-shadow hover:shadow-md',
        !account.isActive && 'opacity-60',
      )}
    >
      {/* 操作按钮（hover 显示） */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1.5 rounded-lg text-text-tertiary hover:text-primary-600 hover:bg-primary-50 transition-colors"
          title="编辑"
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            account.isActive
              ? 'text-text-tertiary hover:text-expense hover:bg-expense/5'
              : 'text-text-tertiary hover:text-income hover:bg-income/5',
          )}
          title={account.isActive ? '停用' : '启用'}
        >
          {account.isActive ? <PowerOff size={15} /> : <Power size={15} />}
        </button>
      </div>

      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: meta.color + '20' }}
        >
          <Icon size={20} style={{ color: meta.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-text-primary truncate">{account.name}</div>
          {subtitle && <div className="text-xs text-text-tertiary truncate mt-0.5">{subtitle}</div>}
        </div>
      </div>

      {/* 金额区 */}
      <div className="mt-4">
        {isCredit ? (
          <>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-text-tertiary">可用额度</span>
              <span className="font-semibold text-text-primary tabular-nums">
                {formatCurrency(available)}
              </span>
            </div>
            {/* 使用进度条 */}
            <div className="h-2 rounded-full bg-surface-dark overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${usedPercent}%`, backgroundColor: meta.color }}
              />
            </div>
            <div className="flex justify-between text-xs text-text-tertiary mt-1">
              <span>欠款 {formatCurrency(account.balance)}</span>
              <span>授信 {formatCurrency(limit)}</span>
            </div>
            {account.billingDay && (
              <div className="flex gap-3 mt-2 text-xs text-text-secondary">
                <span>账单日 {account.billingDay} 日</span>
                {dueDays != null && <span>距还款 {dueDays} 天</span>}
              </div>
            )}
          </>
        ) : (
          <div className="text-2xl font-bold text-text-primary tabular-nums">
            {formatCurrency(account.balance)}
          </div>
        )}
      </div>

      {!account.isActive && (
        <div className="mt-3 inline-block px-2 py-0.5 text-xs rounded bg-[rgba(148,163,184,0.1)] text-text-tertiary">
          已停用
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TransactionType } from '@/types/transaction';
import { getTransactions } from '@/services/transaction.service';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Account } from '@/types/account';
import type { Transaction as Tx } from '@/types/transaction';

/**
 * 账户交易流水抽屉（功能C）
 * 点击账户卡片后打开，列出该账户下的全部交易（按日期倒序）。
 */
interface AccountTransactionsDrawerProps {
  account: Account | null; // 有值=查看该账户流水
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountTransactionsDrawer({
  account,
  open,
  onOpenChange,
}: AccountTransactionsDrawerProps) {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 打开时拉取该账户全部交易
  useEffect(() => {
    if (!open || !account) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getTransactions({ accountId: account.id, pageSize: 100 });
        if (!cancelled) setTxs(res.items);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || '加载交易失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, account]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {account ? `${account.name} · 交易流水` : '交易流水'}
          </DialogTitle>
        </DialogHeader>

        {/* 账户余额标题 */}
        {account && (
          <div className="flex items-center justify-between rounded-lg bg-primary-50/40 px-4 py-3">
            <span className="text-sm text-text-secondary">当前余额</span>
            <span className="text-lg font-bold text-text-primary tabular-nums">
              {formatCurrency(account.balance)}
            </span>
          </div>
        )}

        {/* 列表区 */}
        <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1">
          {loading ? (
            <div className="py-10 text-center text-text-secondary">加载中...</div>
          ) : error ? (
            <div className="py-10 text-center text-expense">{error}</div>
          ) : txs.length === 0 ? (
            <div className="py-10 text-center text-text-tertiary">
              该账户暂无交易记录
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {txs.map((tx) => (
                <li key={tx.id} className="flex items-center gap-3 py-3">
                  {/* 分类色点 */}
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: tx.category?.color || '#94A3B8' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-text-primary truncate">
                      {tx.merchant || tx.category?.name || tx.note || '交易'}
                    </div>
                    <div className="text-xs text-text-tertiary truncate">
                      {formatDate(new Date(tx.date), 'yyyy-MM-dd')}
                      {tx.category?.name ? ` · ${tx.category.name}` : ''}
                      {tx.note ? ` · ${tx.note}` : ''}
                    </div>
                  </div>
                  <div
                    className={cn(
                      'text-sm font-semibold tabular-nums shrink-0',
                      tx.type === TransactionType.INCOME
                        ? 'text-income'
                        : tx.type === TransactionType.EXPENSE
                          ? 'text-expense'
                          : 'text-text-primary',
                    )}
                  >
                    {tx.type === TransactionType.INCOME ? '+' : tx.type === TransactionType.EXPENSE ? '-' : ''}
                    {formatCurrency(tx.amount)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

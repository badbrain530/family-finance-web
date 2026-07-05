import { cn, formatCurrency } from '@/lib/utils';
import type { TransactionType } from '@/types/transaction';

/**
 * 金额展示组件
 * 收入显示绿色，支出显示红色
 */
interface AmountTextProps {
  amount: number;
  type: TransactionType;
  showSign?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeMap = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-2xl',
};

export function AmountText({
  amount,
  type,
  showSign = true,
  className,
  size = 'md',
}: AmountTextProps) {
  const isIncome = type === 'income' as TransactionType;
  const sign = showSign ? (isIncome ? '+' : '-') : '';
  const colorClass = isIncome ? 'text-income' : 'text-expense';

  return (
    <span className={cn('font-semibold tabular-nums', colorClass, sizeMap[size], className)}>
      {sign}
      {formatCurrency(amount)}
    </span>
  );
}

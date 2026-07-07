import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toaster';
import { updateTransaction } from '@/services/transaction.service';
import { getCategories } from '@/services/category.service';
import { getAccounts } from '@/services/account.service';
import { getCurrentFamily } from '@/services/family.service';
import { formatDate } from '@/lib/utils';
import type { Transaction, Category, UpdateTransactionRequest } from '@/types/transaction';
import { TransactionType } from '@/types/transaction';
import type { Account } from '@/types/account';

/** 收入类一级分类名称（用于按交易类型过滤分类树） */
const INCOME_ROOT_NAMES = ['薪资收入', '投资收益', '兼职收入', '其他收入'];

/**
 * 交易编辑弹窗
 * 支持修改：金额、日期、类型、账户（必选）、分类（真实API树形）、商户、备注
 */
interface EditTransactionModalProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditTransactionModal({
  transaction,
  open,
  onOpenChange,
  onSaved,
}: EditTransactionModalProps) {
  const { toast } = useToast();

  // 表单状态
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [saving, setSaving] = useState(false);

  // 真实数据
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // 打开弹窗时填充表单并加载账户/分类
  useEffect(() => {
    if (!transaction || !open) return;

    setAmount(String(transaction.amount));
    setDate(formatDate(transaction.date, 'yyyy-MM-dd'));
    setType(transaction.type);
    setMerchant(transaction.merchant || '');
    setNote(transaction.note || '');
    setCategoryId(transaction.categoryId || '');
    setAccountId(transaction.accountId || '');

    // 并行加载账户与分类（按 familyId 隔离）
    (async () => {
      try {
        const family = await getCurrentFamily();
        const [cats, accs] = await Promise.all([
          getCategories(family.id),
          getAccounts(family.id),
        ]);
        setCategories(cats);
        setAccounts(accs);
      } catch (err: any) {
        toast({ title: '加载账户/分类失败', description: err?.message, variant: 'destructive' });
      }
    })();
  }, [transaction, open]);

  // 按交易类型过滤一级分类（收入/支出）
  const filteredRoots = categories.filter((root) => {
    const isIncome = INCOME_ROOT_NAMES.includes(root.name) || root.name.includes('收入');
    return type === 'income' ? isIncome : !isIncome;
  });

  const handleSave = async () => {
    if (!transaction) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({ title: '请输入有效的金额', variant: 'destructive' });
      return;
    }
    if (!date) {
      toast({ title: '请选择日期', variant: 'destructive' });
      return;
    }
    if (!accountId) {
      toast({ title: '请选择账户', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const dto: UpdateTransactionRequest = {
        amount: numAmount,
        date: new Date(date).toISOString(),
        type,
        merchant: merchant || undefined,
        note: note || undefined,
        categoryId: categoryId || undefined,
        accountId: accountId || null,
      };
      await updateTransaction(transaction.id, dto);
      toast({ title: '交易已更新', variant: 'success' });
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast({ title: '更新失败', description: err?.message || '请重试', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>编辑交易</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 金额 */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-amount">金额（元）</Label>
            <Input
              id="edit-amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* 日期 */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-date">日期</Label>
            <Input
              id="edit-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* 类型 */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-type">类型</Label>
            <Select
              value={type}
              onValueChange={(v: 'income' | 'expense' | 'transfer') => {
                setType(v as TransactionType);
                setCategoryId(''); // 切换类型清空分类（账户保留，设计 §4.5）
              }}
            >
              <SelectTrigger id="edit-type">
                <SelectValue placeholder="选择类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">支出</SelectItem>
                <SelectItem value="income">收入</SelectItem>
                <SelectItem value="transfer">转账</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 账户（必选） */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-account">账户 *</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="edit-account">
                <SelectValue placeholder="选择账户" />
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

          {/* 分类（真实API树形） */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-category">分类</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="edit-category">
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                {filteredRoots.map((root) => (
                  <div key={root.id}>
                    <SelectLabel>{root.name}</SelectLabel>
                    {root.children?.map((child) => (
                      <SelectItem key={child.id} value={child.id}>
                        {child.name}
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 商户 */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-merchant">商户</Label>
            <Input
              id="edit-merchant"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="商户名称（可选）"
            />
          </div>

          {/* 备注 */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-note">备注</Label>
            <Input
              id="edit-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="备注（可选）"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存修改'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

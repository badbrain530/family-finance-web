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
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectGroup,
  SelectSeparator,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toaster';
import { updateTransaction, refundTransaction, markReimbursement, cancelReimbursement, confirmReimbursement } from '@/services/transaction.service';
import { getCategories } from '@/services/category.service';
import { getAccounts } from '@/services/account.service';
import { getCurrentFamily } from '@/services/family.service';
import { formatDate } from '@/lib/utils';
import type { Transaction, Category, UpdateTransactionRequest } from '@/types/transaction';
import { TransactionType } from '@/types/transaction';
import type { Account } from '@/types/account';
import { RotateCcw, HandCoins } from 'lucide-react';

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

  // 退款/报销操作区状态
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundDate, setRefundDate] = useState('');
  const [refundAccount, setRefundAccount] = useState('');
  const [reimbSource, setReimbSource] = useState<'family' | 'company'>('family');
  const [reimbDate, setReimbDate] = useState('');
  const [reimbAccount, setReimbAccount] = useState('');
  const [acting, setActing] = useState(false);

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

    // 退款/报销区默认填充
    setRefundOpen(false);
    setRefundAmount(transaction.amount ? String(transaction.amount) : '');
    setRefundDate(formatDate(transaction.date, 'yyyy-MM-dd'));
    setRefundAccount(transaction.accountId || '');
    setReimbSource('family');
    setReimbDate(formatDate(new Date().toISOString(), 'yyyy-MM-dd'));
    setReimbAccount(transaction.accountId || '');

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
                  <SelectGroup key={root.id}>
                    <SelectLabel>{root.name}</SelectLabel>
                    {root.children?.map((child) => (
                      <SelectItem key={child.id} value={child.id}>
                        {child.name}
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                  </SelectGroup>
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

          {/* ===== 退款 / 报销 操作区（仅支出交易） ===== */}
          {transaction?.type === TransactionType.EXPENSE && (
            <div className="space-y-3 rounded-lg border border-border p-3 bg-surface/50">
              {/* 退款状态 */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">退款</span>
                <Badge variant={
                  transaction.refundStatus === 'FULL' ? 'success'
                    : transaction.refundStatus === 'PARTIAL' ? 'default' : 'outline'
                }>
                  {transaction.refundStatus === 'FULL' ? '已全额退款'
                    : transaction.refundStatus === 'PARTIAL' ? '部分退款'
                    : '未退款'}
                  {transaction.refundedAmount ? `（${transaction.refundedAmount}/${transaction.amount}）` : ''}
                </Badge>
              </div>

              {!refundOpen ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setRefundOpen(true)}
                  disabled={transaction.refundStatus === 'FULL'}
                >
                  <RotateCcw size={14} className="mr-1.5" />
                  发起退款
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>退款金额</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>退款日期</Label>
                      <Input type="date" value={refundDate} onChange={(e) => setRefundDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>退款账户</Label>
                    <Select value={refundAccount} onValueChange={setRefundAccount}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择账户" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={acting}
                      onClick={async () => {
                        const amt = parseFloat(refundAmount);
                        if (isNaN(amt) || amt <= 0) {
                          toast({ title: '请输入有效退款金额', variant: 'destructive' });
                          return;
                        }
                        setActing(true);
                        try {
                          await refundTransaction(transaction.id, {
                            amount: amt,
                            date: new Date(refundDate).toISOString(),
                            accountId: refundAccount || null,
                          });
                          toast({ title: '退款成功', variant: 'success' });
                          onSaved();
                          onOpenChange(false);
                        } catch (err: any) {
                          toast({ title: '退款失败', description: err?.message, variant: 'destructive' });
                        } finally {
                          setActing(false);
                        }
                      }}
                    >
                      确认退款
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setRefundOpen(false)}>取消</Button>
                  </div>
                </div>
              )}

              <Separator />

              {/* 报销状态 */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">报销</span>
                <Badge variant={
                  transaction.reimbursementStatus === 'REIMBURSED' ? 'success'
                    : transaction.reimbursementStatus === 'PENDING' ? 'default' : 'outline'
                }>
                  {transaction.reimbursementStatus === 'REIMBURSED' ? '已报销'
                    : transaction.reimbursementStatus === 'PENDING' ? '待报销' : '未报销'}
                </Badge>
              </div>

              {transaction.reimbursementStatus === 'NONE' && (
                <div className="flex items-center gap-2">
                  <Select value={reimbSource} onValueChange={(v: 'family' | 'company') => setReimbSource(v)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="family">家庭共同账户</SelectItem>
                      <SelectItem value="company">公司/外部</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={acting}
                    onClick={async () => {
                      setActing(true);
                      try {
                        await markReimbursement(transaction.id, reimbSource);
                        toast({ title: '已标记为待报销', variant: 'success' });
                        onSaved();
                        onOpenChange(false);
                      } catch (err: any) {
                        toast({ title: '标记失败', description: err?.message, variant: 'destructive' });
                      } finally {
                        setActing(false);
                      }
                    }}
                  >
                    <HandCoins size={14} className="mr-1.5" />
                    标记待报销
                  </Button>
                </div>
              )}

              {transaction.reimbursementStatus === 'PENDING' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>到账日期</Label>
                      <Input type="date" value={reimbDate} onChange={(e) => setReimbDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>入账账户</Label>
                      <Select value={reimbAccount} onValueChange={setReimbAccount}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择账户" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={acting}
                      onClick={async () => {
                        setActing(true);
                        try {
                          await confirmReimbursement(transaction.id, {
                            date: new Date(reimbDate).toISOString(),
                            accountId: reimbAccount || null,
                          });
                          toast({ title: '报销成功', variant: 'success' });
                          onSaved();
                          onOpenChange(false);
                        } catch (err: any) {
                          toast({ title: '报销失败', description: err?.message, variant: 'destructive' });
                        } finally {
                          setActing(false);
                        }
                      }}
                    >
                      确认报销
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={acting}
                      onClick={async () => {
                        setActing(true);
                        try {
                          await cancelReimbursement(transaction.id);
                          toast({ title: '已取消待报销', variant: 'success' });
                          onSaved();
                          onOpenChange(false);
                        } catch (err: any) {
                          toast({ title: '操作失败', description: err?.message, variant: 'destructive' });
                        } finally {
                          setActing(false);
                        }
                      }}
                    >
                      取消标记
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
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

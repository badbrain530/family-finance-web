import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCurrentFamily } from '@/services/family.service';
import { getLedgers } from '@/services/ledger.service';
import { getAccounts } from '@/services/account.service';
import { getCategories } from '@/services/category.service';
import {
  listRules,
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
  generateNow,
} from '@/services/recurring.service';
import type { CreateRecurringRuleRequest } from '@/services/recurring.service';
import { useToast } from '@/components/ui/toaster';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Switch } from '@/components/ui/switch';
import { formatCurrency, formatDate } from '@/lib/utils';
import { TransactionType, type Frequency, type RecurringRule, type Category } from '@/types/transaction';
import type { Ledger } from '@/types/family';
import type { Account } from '@/types/account';
import { Plus, RefreshCw, Pencil, Trash2, Repeat } from 'lucide-react';

/**
 * 周期记账规则页面
 * - 规则表格：名称/金额/类型/频率/下次执行(nextRunAt)/状态(isActive)
 * - 操作：启用/停用开关、立即生成、新建/编辑（弹窗）、删除
 */

const FREQUENCY_LABELS: Record<Frequency, string> = {
  DAILY: '每天',
  WEEKLY: '每周',
  MONTHLY: '每月',
  YEARLY: '每年',
};

interface RecurringFormState {
  id: string | null;
  ledgerId: string;
  categoryId: string;
  accountId: string;
  type: TransactionType;
  amount: string;
  merchant: string;
  note: string;
  frequency: Frequency;
  interval: string;
  weekday: string;
  monthDay: string;
  startDate: string;
  endDate: string;
}

const emptyForm = (ledgerId: string): RecurringFormState => ({
  id: null,
  ledgerId,
  categoryId: '',
  accountId: '',
  type: TransactionType.EXPENSE,
  amount: '',
  merchant: '',
  note: '',
  frequency: 'MONTHLY',
  interval: '1',
  weekday: '1',
  monthDay: '1',
  startDate: formatDate(new Date(), 'yyyy-MM-dd'),
  endDate: '',
});

export function RecurringPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [familyId, setFamilyId] = useState<string>('');
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<RecurringFormState>(emptyForm(''));
  const [saving, setSaving] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  // ===== 基础数据加载（family / ledgers / accounts / categories） =====
  useEffect(() => {
    (async () => {
      try {
        const family = await getCurrentFamily();
        setFamilyId(family.id);
        const [ledgerList, accList, catList] = await Promise.all([
          getLedgers(family.id),
          getAccounts(family.id),
          getCategories(family.id),
        ]);
        setLedgers(ledgerList);
        setAccounts(accList);
        setCategories(catList);
      } catch (err: any) {
        toast({ title: '加载基础数据失败', description: err?.message, variant: 'destructive' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const defaultLedgerId = useMemo(() => {
    if (ledgers.length === 0) return '';
    const shared = ledgers.find((l) => l.type === 'shared');
    return (shared ?? ledgers[0]).id;
  }, [ledgers]);

  // ===== 规则列表 =====
  const { data: rules = [], isLoading, isError, error } = useQuery({
    queryKey: ['recurring', familyId],
    queryFn: () => listRules(familyId),
    enabled: !!familyId,
  });

  // ===== 构建请求体（对齐 CreateRecurringRuleRequest） =====
  const buildPayload = (): CreateRecurringRuleRequest => {
    const payload: CreateRecurringRuleRequest = {
      ledgerId: form.ledgerId,
      type: form.type as 'income' | 'expense',
      amount: Number(form.amount),
      frequency: form.frequency,
      startDate: form.startDate,
      interval: Number(form.interval) || 1,
      categoryId: form.categoryId || null,
      accountId: form.accountId || null,
      merchant: form.merchant || undefined,
      note: form.note || undefined,
      endDate: form.endDate || undefined,
      weekday: form.frequency === 'WEEKLY' ? Number(form.weekday) : undefined,
      monthDay: form.frequency === 'MONTHLY' ? Number(form.monthDay) : undefined,
    };
    return payload;
  };

  // ===== 新建 / 编辑提交 =====
  const handleSave = async () => {
    if (!form.ledgerId) {
      toast({ title: '请选择账本', variant: 'destructive' });
      return;
    }
    const amountNum = Number(form.amount);
    if (!amountNum || amountNum <= 0) {
      toast({ title: '金额必须大于 0', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      if (form.id) {
        await updateRule(form.id, payload);
        toast({ title: '规则已更新' });
      } else {
        await createRule(payload);
        toast({ title: '规则已创建' });
      }
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['recurring', familyId] });
    } catch (err: any) {
      toast({ title: '保存失败', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ===== 启用 / 停用 =====
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleRule(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring', familyId] }),
    onError: (err: any) =>
      toast({ title: '操作失败', description: err?.message, variant: 'destructive' }),
  });

  // ===== 立即生成（单条） =====
  const handleGenerate = async (id: string) => {
    setGeneratingId(id);
    try {
      const res = await generateNow(id);
      toast({ title: `已生成 ${res.generated} 笔交易` });
      queryClient.invalidateQueries({ queryKey: ['recurring', familyId] });
    } catch (err: any) {
      toast({ title: '生成失败', description: err?.message, variant: 'destructive' });
    } finally {
      setGeneratingId(null);
    }
  };

  // ===== 删除 =====
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRule(id),
    onSuccess: () => {
      toast({ title: '规则已删除' });
      queryClient.invalidateQueries({ queryKey: ['recurring', familyId] });
    },
    onError: (err: any) =>
      toast({ title: '删除失败', description: err?.message, variant: 'destructive' }),
  });

  const openCreate = () => {
    setForm(emptyForm(defaultLedgerId));
    setDialogOpen(true);
  };

  const openEdit = (rule: RecurringRule) => {
    setForm({
      id: rule.id,
      ledgerId: rule.ledgerId,
      categoryId: rule.categoryId || '',
      accountId: rule.accountId || '',
      type: rule.type,
      amount: String(rule.amount),
      merchant: rule.merchant || '',
      note: rule.note || '',
      frequency: rule.frequency,
      interval: String(rule.interval || 1),
      weekday: String(rule.weekday || 1),
      monthDay: String(rule.monthDay || 1),
      startDate: rule.startDate?.slice(0, 10) || formatDate(new Date(), 'yyyy-MM-dd'),
      endDate: rule.endDate?.slice(0, 10) || '',
    });
    setDialogOpen(true);
  };

  const categoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name || '—';
  const accountName = (id: string | null) =>
    accounts.find((a) => a.id === id)?.name || '—';

  return (
    <div className="page-container">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">周期记账</h1>
          <p className="text-text-secondary mt-1">自动按频率生成周期性交易（如房租、工资）</p>
        </div>
        <Button size="sm" onClick={openCreate} disabled={!defaultLedgerId}>
          <Plus size={14} />
          新建规则
        </Button>
      </div>

      {isLoading ? (
        <LoadingSpinner fullScreen />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh]">
          <p className="text-expense font-medium">加载失败</p>
          <p className="text-text-secondary mt-2">{(error as Error)?.message || '请检查网络'}</p>
        </div>
      ) : rules.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<Repeat size={48} />}
            title="暂无周期规则"
            description="点击「新建规则」创建你的第一个自动记账规则"
            action={<Button onClick={openCreate}>新建规则</Button>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>频率</TableHead>
                <TableHead>下次执行</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <div className="font-medium text-text-primary">{rule.merchant || '未命名规则'}</div>
                    <div className="text-xs text-text-tertiary">
                      {categoryName(rule.categoryId)} · {accountName(rule.accountId)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={rule.type === 'income' ? 'text-income font-medium' : 'text-expense font-medium'}>
                      {formatCurrency(rule.amount)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={rule.type === 'income' ? 'default' : 'secondary'}>
                      {rule.type === 'income' ? '收入' : '支出'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-text-secondary">
                    {FREQUENCY_LABELS[rule.frequency]}
                    {rule.interval > 1 ? `（每${rule.interval}次）` : ''}
                  </TableCell>
                  <TableCell className="text-text-secondary whitespace-nowrap">
                    {rule.nextRunAt ? formatDate(rule.nextRunAt, 'yyyy-MM-dd') : '—'}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: rule.id, isActive: v })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="立即生成"
                        disabled={generatingId === rule.id}
                        onClick={() => handleGenerate(rule.id)}
                      >
                        <RefreshCw size={14} className={generatingId === rule.id ? 'animate-spin' : ''} />
                      </Button>
                      <Button variant="ghost" size="sm" title="编辑" onClick={() => openEdit(rule)}>
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="删除"
                        className="text-expense hover:text-expense"
                        onClick={() => deleteMutation.mutate(rule.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* 新建 / 编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? '编辑周期规则' : '新建周期规则'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="col-span-2">
              <Label>账本</Label>
              <Select value={form.ledgerId} onValueChange={(v) => setForm({ ...form, ledgerId: v })}>
                <SelectTrigger><SelectValue placeholder="选择账本" /></SelectTrigger>
                <SelectContent>
                  {ledgers.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label>名称（商户/备注）</Label>
              <Input value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} placeholder="如：房租、工资" />
            </div>

            <div>
              <Label>类型</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as TransactionType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">支出</SelectItem>
                  <SelectItem value="income">收入</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>金额</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
            </div>

            <div>
              <Label>分类</Label>
              <Select value={form.categoryId || 'none'} onValueChange={(v) => setForm({ ...form, categoryId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="可选" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不指定</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>账户</Label>
              <Select value={form.accountId || 'none'} onValueChange={(v) => setForm({ ...form, accountId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="可选" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不指定</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>频率</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as Frequency })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">每天</SelectItem>
                  <SelectItem value="WEEKLY">每周</SelectItem>
                  <SelectItem value="MONTHLY">每月</SelectItem>
                  <SelectItem value="YEARLY">每年</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>间隔（次）</Label>
              <Input type="number" min={1} value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })} />
            </div>

            {form.frequency === 'WEEKLY' && (
              <div>
                <Label>星期几（1-7）</Label>
                <Input type="number" min={1} max={7} value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })} />
              </div>
            )}

            {form.frequency === 'MONTHLY' && (
              <div>
                <Label>几号（1-31）</Label>
                <Input type="number" min={1} max={31} value={form.monthDay} onChange={(e) => setForm({ ...form, monthDay: e.target.value })} />
              </div>
            )}

            <div>
              <Label>起始日</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>

            <div>
              <Label>结束日（可选）</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>

            <div className="col-span-2">
              <Label>备注</Label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="可选" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

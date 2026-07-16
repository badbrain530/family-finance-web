import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCurrentFamily } from '@/services/family.service';
import { getLedgers } from '@/services/ledger.service';
import { getAccounts } from '@/services/account.service';
import {
  listAmortizations,
  createAmortization,
  getAmortization,
  generateAmortization,
  deleteAmortization,
} from '@/services/amortization.service';
import type { CreateAmortizationRequest } from '@/services/amortization.service';
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
import { LineChart } from '@/components/charts/LineChart';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { AmortizationType, AmortizationSchedule } from '@/types/transaction';
import type { Ledger } from '@/types/family';
import type { Account } from '@/types/account';
import { Plus, Layers, RefreshCw, Trash2 } from 'lucide-react';

/**
 * 待摊/预付管理页面
 * - 待摊/预付列表：名称/总金额/类型/已摊/剩余
 * - 新建表单（初始入账 EXPENSE + 算全表）
 * - 选中项：摊销计划（图表 + 表格），每期「生成摊销」
 */

const TYPE_LABELS: Record<AmortizationType, string> = {
  PREPAID: '预付（先付后摊）',
  DEFERRED: '待摊（先发生后摊）',
};

const SCHEDULE_STATUS_LABELS: Record<AmortizationSchedule['status'], string> = {
  pending: '待摊',
  posted: '已摊',
  skipped: '已跳过',
};

interface AmortizationFormState {
  ledgerId: string;
  accountId: string;
  name: string;
  totalAmount: string;
  periodMonths: string;
  type: AmortizationType;
  startDate: string;
  note: string;
}

const emptyForm = (ledgerId: string): AmortizationFormState => ({
  ledgerId,
  accountId: '',
  name: '',
  totalAmount: '',
  periodMonths: '',
  type: 'PREPAID',
  startDate: formatDate(new Date(), 'yyyy-MM-dd'),
  note: '',
});

export function AmortizationPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [familyId, setFamilyId] = useState<string>('');
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AmortizationFormState>(emptyForm(''));
  const [saving, setSaving] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const family = await getCurrentFamily();
        setFamilyId(family.id);
        const [ledgerList, accList] = await Promise.all([
          getLedgers(family.id),
          getAccounts(family.id),
        ]);
        setLedgers(ledgerList);
        setAccounts(accList);
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

  // ===== 待摊/预付列表（含完整摊销计划） =====
  const { data: items = [], isLoading, isError, error } = useQuery({
    queryKey: ['amortizations', familyId],
    queryFn: () => listAmortizations(familyId),
    enabled: !!familyId,
  });

  // 选中项的明细（带 schedules）
  const { data: selectedItem, isFetching: itemFetching } = useQuery({
    queryKey: ['amortization-detail', selectedId],
    queryFn: () => getAmortization(selectedId as string),
    enabled: !!selectedId,
  });

  // 选中后置默认
  useEffect(() => {
    if (!selectedId && items.length > 0) setSelectedId(items[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const schedules: AmortizationSchedule[] = selectedItem?.schedules || [];

  const chartData = useMemo(() => {
    if (schedules.length === 0) return null;
    const xLabels = schedules.map((s) => `第${s.seq}期`);
    return {
      xLabels,
      amount: schedules.map((s) => Number(s.amount.toFixed(2))),
      remaining: [Number(selectedItem?.remainingAmount.toFixed(2))],
    };
  }, [schedules, selectedItem]);

  // ===== 新建待摊/预付 =====
  const handleCreate = async () => {
    const totalNum = Number(form.totalAmount);
    const periodNum = Number(form.periodMonths);
    if (!form.ledgerId || !form.name || !totalNum || !periodNum) {
      toast({ title: '请填写完整信息', variant: 'destructive' });
      return;
    }
    const payload: CreateAmortizationRequest = {
      ledgerId: form.ledgerId,
      accountId: form.accountId || null,
      name: form.name,
      totalAmount: totalNum,
      periodMonths: periodNum,
      type: form.type,
      startDate: form.startDate,
      note: form.note || undefined,
    };
    setSaving(true);
    try {
      await createAmortization(payload);
      toast({ title: '待摊/预付已创建' });
      setDialogOpen(false);
      setForm(emptyForm(defaultLedgerId));
      queryClient.invalidateQueries({ queryKey: ['amortizations', familyId] });
    } catch (err: any) {
      toast({ title: '创建失败', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ===== 生成摊销（到期 pending 计划） =====
  const handleGenerate = async () => {
    if (!selectedId) return;
    setGenerating(true);
    try {
      const res = await generateAmortization(selectedId);
      toast({ title: `已生成 ${res.generated} 笔摊销交易` });
      queryClient.invalidateQueries({ queryKey: ['amortization-detail', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['amortizations', familyId] });
    } catch (err: any) {
      toast({ title: '生成失败', description: err?.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // ===== 删除 =====
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAmortization(id),
    onSuccess: () => {
      toast({ title: '待摊/预付已删除' });
      if (selectedId) setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['amortizations', familyId] });
    },
    onError: (err: any) =>
      toast({ title: '删除失败', description: err?.message, variant: 'destructive' }),
  });

  const accountName = (id: string | null) =>
    accounts.find((a) => a.id === id)?.name || '—';

  return (
    <div className="page-container">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">待摊/预付管理</h1>
          <p className="text-text-secondary mt-1">管理预付与待摊费用的递延摊销</p>
        </div>
        <Button size="sm" onClick={() => { setForm(emptyForm(defaultLedgerId)); setDialogOpen(true); }} disabled={!defaultLedgerId}>
          <Plus size={14} />
          新建待摊/预付
        </Button>
      </div>

      {isLoading ? (
        <LoadingSpinner fullScreen />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh]">
          <p className="text-expense font-medium">加载失败</p>
          <p className="text-text-secondary mt-2">{(error as Error)?.message || '请检查网络'}</p>
        </div>
      ) : items.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<Layers size={48} />}
            title="暂无待摊/预付"
            description="点击「新建待摊/预付」添加一笔递延费用"
            action={<Button onClick={() => { setForm(emptyForm(defaultLedgerId)); setDialogOpen(true); }}>新建待摊/预付</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 左：列表 */}
          <Card className="overflow-hidden lg:col-span-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>总额</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.id}
                    className={`cursor-pointer ${selectedId === item.id ? 'bg-primary/5' : ''}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <TableCell>
                      <div className="font-medium text-text-primary">{item.name}</div>
                      <div className="text-xs text-text-tertiary">
                        {TYPE_LABELS[item.type]} · {item.periodMonths}期
                      </div>
                    </TableCell>
                    <TableCell className="text-text-secondary whitespace-nowrap">
                      {formatCurrency(item.totalAmount)}
                      <div className="text-xs text-text-tertiary">余 {formatCurrency(item.remainingAmount)}</div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-expense hover:text-expense"
                        onClick={() => deleteMutation.mutate(item.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* 右：摊销计划 */}
          <Card className="p-4 lg:col-span-2">
            {itemFetching ? (
              <LoadingSpinner />
            ) : selectedItem ? (
              <div>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">{selectedItem.name}</h2>
                    <p className="text-sm text-text-secondary">
                      总额 {formatCurrency(selectedItem.totalAmount)} · 已摊 {formatCurrency(selectedItem.amortizedAmount)} ·
                      剩余 {formatCurrency(selectedItem.remainingAmount)} · {TYPE_LABELS[selectedItem.type]} · {selectedItem.periodMonths} 期
                    </p>
                    <p className="text-xs text-text-tertiary">入账账户：{accountName(selectedItem.accountId)}</p>
                  </div>
                  <Button size="sm" onClick={handleGenerate} disabled={generating}>
                    <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
                    生成到期摊销
                  </Button>
                </div>

                {/* 图表：每期摊销额 / 剩余 */}
                {chartData ? (
                  <LineChart
                    height={260}
                    xLabels={chartData.xLabels}
                    series={[
                      { name: '当期摊销', data: chartData.amount, color: '#3B82F6' },
                      { name: '剩余待摊', data: chartData.remaining, color: '#10B981' },
                    ]}
                  />
                ) : (
                  <p className="text-text-tertiary text-sm">暂无摊销计划</p>
                )}

                {/* 明细表格 */}
                <div className="mt-4 overflow-auto max-h-72">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>期次</TableHead>
                        <TableHead>到期日</TableHead>
                        <TableHead className="text-right">摊销额</TableHead>
                        <TableHead>状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedules.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-text-secondary">{s.seq}</TableCell>
                          <TableCell className="text-text-secondary whitespace-nowrap">{formatDate(s.dueDate, 'yyyy-MM-dd')}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(s.amount)}</TableCell>
                          <TableCell>
                            <Badge variant={s.status === 'posted' ? 'default' : s.status === 'skipped' ? 'secondary' : 'outline'}>
                              {SCHEDULE_STATUS_LABELS[s.status]}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <EmptyState icon={<Layers size={48} />} title="选择一项查看摊销计划" />
            )}
          </Card>
        </div>
      )}

      {/* 新建弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新建待摊/预付</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
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
              <Label>名称</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：年费、装修" />
            </div>
            <div>
              <Label>总金额（元）</Label>
              <Input type="number" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <Label>摊销期数（月）</Label>
              <Input type="number" min={1} value={form.periodMonths} onChange={(e) => setForm({ ...form, periodMonths: e.target.value })} placeholder="如 12" />
            </div>
            <div>
              <Label>类型</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as AmortizationType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PREPAID">预付（先付后摊）</SelectItem>
                  <SelectItem value="DEFERRED">待摊（先发生后摊）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>开始日（初始入账日）</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>入账账户（可选）</Label>
              <Select value={form.accountId || 'none'} onValueChange={(v) => setForm({ ...form, accountId: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="不指定" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不指定</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>备注（可选）</Label>
              <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="可选" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? '创建中…' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

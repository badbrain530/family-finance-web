import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCurrentFamily } from '@/services/family.service';
import { getLedgers } from '@/services/ledger.service';
import { getAccounts } from '@/services/account.service';
import {
  listBonds,
  createBond,
  getBond,
  generatePayments,
  deleteBond,
} from '@/services/bond.service';
import type { CreateBondRequest } from '@/services/bond.service';
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
import type { CouponFrequency, BondSchedule } from '@/types/transaction';
import type { Ledger } from '@/types/family';
import type { Account } from '@/types/account';
import { Plus, Landmark, RefreshCw, Trash2 } from 'lucide-react';

/**
 * 债券（持有方）管理页面
 * - 债券列表：名称/面值/年利率/期限/票息频率/起息日
 * - 新建债券表单
 * - 选中债券：票息计划（图表 + 表格），每期「生成票息」
 */

const COUPON_FREQ_LABELS: Record<CouponFrequency, string> = {
  MONTHLY: '按月付息',
  QUARTERLY: '按季付息',
  SEMI: '按半年付息',
  ANNUAL: '按年付息',
};

const SCHEDULE_STATUS_LABELS: Record<BondSchedule['status'], string> = {
  pending: '待收',
  paid: '已收',
  skipped: '已跳过',
};

interface BondFormState {
  ledgerId: string;
  accountId: string;
  name: string;
  faceValue: string;
  annualRate: string;
  termMonths: string;
  couponFrequency: CouponFrequency;
  startDate: string;
}

const emptyForm = (ledgerId: string): BondFormState => ({
  ledgerId,
  accountId: '',
  name: '',
  faceValue: '',
  annualRate: '',
  termMonths: '',
  couponFrequency: 'MONTHLY',
  startDate: formatDate(new Date(), 'yyyy-MM-dd'),
});

export function BondsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [familyId, setFamilyId] = useState<string>('');
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<BondFormState>(emptyForm(''));
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

  // ===== 债券列表（含完整票息计划） =====
  const { data: bonds = [], isLoading, isError, error } = useQuery({
    queryKey: ['bonds', familyId],
    queryFn: () => listBonds(familyId),
    enabled: !!familyId,
  });

  // 选中债券的明细（带 schedules）
  const { data: selectedBond, isFetching: bondFetching } = useQuery({
    queryKey: ['bond-detail', selectedId],
    queryFn: () => getBond(selectedId as string),
    enabled: !!selectedId,
  });

  // 选中后置默认
  useEffect(() => {
    if (!selectedId && bonds.length > 0) setSelectedId(bonds[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bonds]);

  const schedules: BondSchedule[] = selectedBond?.schedules || [];

  const chartData = useMemo(() => {
    if (schedules.length === 0) return null;
    const xLabels = schedules.map((s) => `第${s.seq}期`);
    return {
      xLabels,
      coupon: schedules.map((s) => Number(s.coupon.toFixed(2))),
      principalReturn: schedules.map((s) => Number(s.principalReturn.toFixed(2))),
      remaining: schedules.map((s) => Number(s.remainingPrincipal.toFixed(2))),
    };
  }, [schedules]);

  // ===== 新建债券 =====
  const handleCreate = async () => {
    const faceValueNum = Number(form.faceValue);
    const rateNum = Number(form.annualRate);
    const termNum = Number(form.termMonths);
    if (!form.ledgerId || !form.name || !faceValueNum || !rateNum || !termNum) {
      toast({ title: '请填写完整债券信息', variant: 'destructive' });
      return;
    }
    const payload: CreateBondRequest = {
      ledgerId: form.ledgerId,
      accountId: form.accountId || null,
      name: form.name,
      faceValue: faceValueNum,
      annualRate: rateNum,
      termMonths: termNum,
      couponFrequency: form.couponFrequency,
      startDate: form.startDate,
    };
    setSaving(true);
    try {
      await createBond(payload);
      toast({ title: '债券已创建' });
      setDialogOpen(false);
      setForm(emptyForm(defaultLedgerId));
      queryClient.invalidateQueries({ queryKey: ['bonds', familyId] });
    } catch (err: any) {
      toast({ title: '创建失败', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ===== 生成票息（到期 pending 计划） =====
  const handleGenerate = async () => {
    if (!selectedId) return;
    setGenerating(true);
    try {
      const res = await generatePayments(selectedId);
      toast({ title: `已生成 ${res.generated} 笔票息交易` });
      queryClient.invalidateQueries({ queryKey: ['bond-detail', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['bonds', familyId] });
    } catch (err: any) {
      toast({ title: '生成失败', description: err?.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // ===== 删除债券 =====
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBond(id),
    onSuccess: () => {
      toast({ title: '债券已删除' });
      if (selectedId) setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['bonds', familyId] });
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
          <h1 className="text-2xl font-bold text-text-primary">债券管理</h1>
          <p className="text-text-secondary mt-1">管理持有债券的票息与本金回收计划</p>
        </div>
        <Button size="sm" onClick={() => { setForm(emptyForm(defaultLedgerId)); setDialogOpen(true); }} disabled={!defaultLedgerId}>
          <Plus size={14} />
          新建债券
        </Button>
      </div>

      {isLoading ? (
        <LoadingSpinner fullScreen />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh]">
          <p className="text-expense font-medium">加载失败</p>
          <p className="text-text-secondary mt-2">{(error as Error)?.message || '请检查网络'}</p>
        </div>
      ) : bonds.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<Landmark size={48} />}
            title="暂无债券"
            description="点击「新建债券」添加一笔持有的债券"
            action={<Button onClick={() => { setForm(emptyForm(defaultLedgerId)); setDialogOpen(true); }}>新建债券</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 左：债券列表 */}
          <Card className="overflow-hidden lg:col-span-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>面值</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bonds.map((bond) => (
                  <TableRow
                    key={bond.id}
                    className={`cursor-pointer ${selectedId === bond.id ? 'bg-primary/5' : ''}`}
                    onClick={() => setSelectedId(bond.id)}
                  >
                    <TableCell>
                      <div className="font-medium text-text-primary">{bond.name}</div>
                      <div className="text-xs text-text-tertiary">
                        {COUPON_FREQ_LABELS[bond.couponFrequency]} · {bond.termMonths}期
                      </div>
                    </TableCell>
                    <TableCell className="text-text-secondary whitespace-nowrap">
                      {formatCurrency(bond.faceValue)}
                      <div className="text-xs text-text-tertiary">{bond.annualRate}%</div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-expense hover:text-expense"
                        onClick={() => deleteMutation.mutate(bond.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* 右：票息计划 */}
          <Card className="p-4 lg:col-span-2">
            {bondFetching ? (
              <LoadingSpinner />
            ) : selectedBond ? (
              <div>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">{selectedBond.name}</h2>
                    <p className="text-sm text-text-secondary">
                      面值 {formatCurrency(selectedBond.faceValue)} · 年利率 {selectedBond.annualRate}% ·
                      {COUPON_FREQ_LABELS[selectedBond.couponFrequency]} · {selectedBond.termMonths} 期 · 起息 {formatDate(selectedBond.startDate, 'yyyy-MM-dd')}
                    </p>
                    <p className="text-xs text-text-tertiary">入账账户：{accountName(selectedBond.accountId)}</p>
                  </div>
                  <Button size="sm" onClick={handleGenerate} disabled={generating}>
                    <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
                    生成到期票息
                  </Button>
                </div>

                {/* 图表：每期票息 / 末期本金返还 / 剩余本金 */}
                {chartData ? (
                  <LineChart
                    height={260}
                    xLabels={chartData.xLabels}
                    series={[
                      { name: '当期票息', data: chartData.coupon, color: '#3B82F6' },
                      { name: '末期本金返还', data: chartData.principalReturn, color: '#F59E0B' },
                      { name: '剩余本金', data: chartData.remaining, color: '#10B981' },
                    ]}
                  />
                ) : (
                  <p className="text-text-tertiary text-sm">暂无票息计划</p>
                )}

                {/* 明细表格 */}
                <div className="mt-4 overflow-auto max-h-72">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>期次</TableHead>
                        <TableHead>到期日</TableHead>
                        <TableHead className="text-right">票息</TableHead>
                        <TableHead className="text-right">本金返还</TableHead>
                        <TableHead className="text-right">剩余本金</TableHead>
                        <TableHead>状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedules.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-text-secondary">{s.seq}</TableCell>
                          <TableCell className="text-text-secondary whitespace-nowrap">{formatDate(s.dueDate, 'yyyy-MM-dd')}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(s.coupon)}</TableCell>
                          <TableCell className="text-right text-text-secondary">{formatCurrency(s.principalReturn)}</TableCell>
                          <TableCell className="text-right text-text-secondary">{formatCurrency(s.remainingPrincipal)}</TableCell>
                          <TableCell>
                            <Badge variant={s.status === 'paid' ? 'default' : s.status === 'skipped' ? 'secondary' : 'outline'}>
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
              <EmptyState icon={<Landmark size={48} />} title="选择一笔债券查看票息计划" />
            )}
          </Card>
        </div>
      )}

      {/* 新建债券弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新建债券</DialogTitle>
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
              <Label>债券名称</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：国债、企业债" />
            </div>
            <div>
              <Label>面值（元）</Label>
              <Input type="number" value={form.faceValue} onChange={(e) => setForm({ ...form, faceValue: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <Label>年利率（%）</Label>
              <Input type="number" step="0.01" value={form.annualRate} onChange={(e) => setForm({ ...form, annualRate: e.target.value })} placeholder="如 4.2" />
            </div>
            <div>
              <Label>期限（月）</Label>
              <Input type="number" min={1} value={form.termMonths} onChange={(e) => setForm({ ...form, termMonths: e.target.value })} placeholder="如 36" />
            </div>
            <div>
              <Label>票息频率</Label>
              <Select value={form.couponFrequency} onValueChange={(v) => setForm({ ...form, couponFrequency: v as CouponFrequency })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">按月付息</SelectItem>
                  <SelectItem value="QUARTERLY">按季付息</SelectItem>
                  <SelectItem value="SEMI">按半年付息</SelectItem>
                  <SelectItem value="ANNUAL">按年付息</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>起息日</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
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

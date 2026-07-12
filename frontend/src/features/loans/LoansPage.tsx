import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCurrentFamily } from '@/services/family.service';
import { getLedgers } from '@/services/ledger.service';
import { getAccounts } from '@/services/account.service';
import {
  listLoans,
  createLoan,
  getSchedules,
  generatePayment,
  deleteLoan,
} from '@/services/loan.service';
import type { CreateLoanRequest } from '@/services/loan.service';
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
import type { LoanMethod, LoanSchedule } from '@/types/transaction';
import type { Ledger } from '@/types/family';
import type { Account } from '@/types/account';
import { Plus, Landmark, RefreshCw, Trash2 } from 'lucide-react';

/**
 * 贷款（按揭）管理页面
 * - 贷款列表：名称/本金/年利率/期限/方式/开始日
 * - 新建贷款表单
 * - 选中贷款：还款计划（图表 + 表格），每期「生成还款」
 */

const METHOD_LABELS: Record<LoanMethod, string> = {
  EQUAL_INSTALLMENT: '等额本息',
  EQUAL_PRINCIPAL: '等额本金',
};

const SCHEDULE_STATUS_LABELS: Record<LoanSchedule['status'], string> = {
  pending: '待还',
  paid: '已还',
  skipped: '已跳过',
};

interface LoanFormState {
  ledgerId: string;
  accountId: string;
  name: string;
  principal: string;
  annualRate: string;
  termMonths: string;
  method: LoanMethod;
  startDate: string;
}

const emptyForm = (ledgerId: string): LoanFormState => ({
  ledgerId,
  accountId: '',
  name: '',
  principal: '',
  annualRate: '',
  termMonths: '',
  method: 'EQUAL_INSTALLMENT',
  startDate: formatDate(new Date(), 'yyyy-MM-dd'),
});

export function LoansPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [familyId, setFamilyId] = useState<string>('');
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<LoanFormState>(emptyForm(''));
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

  // ===== 贷款列表（含完整还款计划） =====
  const { data: loans = [], isLoading, isError, error } = useQuery({
    queryKey: ['loans', familyId],
    queryFn: () => listLoans(familyId),
    enabled: !!familyId,
  });

  // 选中贷款的明细（带 schedules）
  const { data: selectedLoan, isFetching: loanFetching } = useQuery({
    queryKey: ['loan-detail', selectedId],
    queryFn: () => getSchedules(selectedId as string),
    enabled: !!selectedId,
  });

  // 选中后置默认
  useEffect(() => {
    if (!selectedId && loans.length > 0) setSelectedId(loans[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loans]);

  const schedules: LoanSchedule[] = selectedLoan?.schedules || [];

  const chartData = useMemo(() => {
    if (schedules.length === 0) return null;
    const xLabels = schedules.map((s) => `第${s.seq}期`);
    return {
      xLabels,
      principal: schedules.map((s) => Number(s.principalPart.toFixed(2))),
      interest: schedules.map((s) => Number(s.interestPart.toFixed(2))),
      remaining: schedules.map((s) => Number(s.remainingPrincipal.toFixed(2))),
    };
  }, [schedules]);

  // ===== 新建贷款 =====
  const handleCreate = async () => {
    const principalNum = Number(form.principal);
    const rateNum = Number(form.annualRate);
    const termNum = Number(form.termMonths);
    if (!form.ledgerId || !form.name || !principalNum || !rateNum || !termNum) {
      toast({ title: '请填写完整贷款信息', variant: 'destructive' });
      return;
    }
    const payload: CreateLoanRequest = {
      ledgerId: form.ledgerId,
      accountId: form.accountId || null,
      name: form.name,
      principal: principalNum,
      annualRate: rateNum,
      termMonths: termNum,
      method: form.method,
      startDate: form.startDate,
    };
    setSaving(true);
    try {
      await createLoan(payload);
      toast({ title: '贷款已创建' });
      setDialogOpen(false);
      setForm(emptyForm(defaultLedgerId));
      queryClient.invalidateQueries({ queryKey: ['loans', familyId] });
    } catch (err: any) {
      toast({ title: '创建失败', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ===== 生成还款（到期 pending 计划） =====
  const handleGenerate = async () => {
    if (!selectedId) return;
    setGenerating(true);
    try {
      const res = await generatePayment(selectedId);
      toast({ title: `已生成 ${res.generated} 笔还款交易` });
      queryClient.invalidateQueries({ queryKey: ['loan-detail', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['loans', familyId] });
    } catch (err: any) {
      toast({ title: '生成失败', description: err?.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // ===== 删除贷款 =====
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLoan(id),
    onSuccess: () => {
      toast({ title: '贷款已删除' });
      if (selectedId) setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['loans', familyId] });
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
          <h1 className="text-2xl font-bold text-text-primary">贷款管理</h1>
          <p className="text-text-secondary mt-1">管理按揭/分期贷款与还款计划</p>
        </div>
        <Button size="sm" onClick={() => { setForm(emptyForm(defaultLedgerId)); setDialogOpen(true); }} disabled={!defaultLedgerId}>
          <Plus size={14} />
          新建贷款
        </Button>
      </div>

      {isLoading ? (
        <LoadingSpinner fullScreen />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh]">
          <p className="text-expense font-medium">加载失败</p>
          <p className="text-text-secondary mt-2">{(error as Error)?.message || '请检查网络'}</p>
        </div>
      ) : loans.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<Landmark size={48} />}
            title="暂无贷款"
            description="点击「新建贷款」添加一笔按揭或分期贷款"
            action={<Button onClick={() => { setForm(emptyForm(defaultLedgerId)); setDialogOpen(true); }}>新建贷款</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 左：贷款列表 */}
          <Card className="overflow-hidden lg:col-span-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>本金</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((loan) => (
                  <TableRow
                    key={loan.id}
                    className={`cursor-pointer ${selectedId === loan.id ? 'bg-primary/5' : ''}`}
                    onClick={() => setSelectedId(loan.id)}
                  >
                    <TableCell>
                      <div className="font-medium text-text-primary">{loan.name}</div>
                      <div className="text-xs text-text-tertiary">
                        {METHOD_LABELS[loan.method]} · {loan.termMonths}期
                      </div>
                    </TableCell>
                    <TableCell className="text-text-secondary whitespace-nowrap">
                      {formatCurrency(loan.principal)}
                      <div className="text-xs text-text-tertiary">{loan.annualRate}%</div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-expense hover:text-expense"
                        onClick={() => deleteMutation.mutate(loan.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* 右：还款计划 */}
          <Card className="p-4 lg:col-span-2">
            {loanFetching ? (
              <LoadingSpinner />
            ) : selectedLoan ? (
              <div>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">{selectedLoan.name}</h2>
                    <p className="text-sm text-text-secondary">
                      本金 {formatCurrency(selectedLoan.principal)} · 年利率 {selectedLoan.annualRate}% ·
                      {METHOD_LABELS[selectedLoan.method]} · {selectedLoan.termMonths} 期 · 始于 {formatDate(selectedLoan.startDate, 'yyyy-MM-dd')}
                    </p>
                    <p className="text-xs text-text-tertiary">扣款账户：{accountName(selectedLoan.accountId)}</p>
                  </div>
                  <Button size="sm" onClick={handleGenerate} disabled={generating}>
                    <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
                    生成到期还款
                  </Button>
                </div>

                {/* 图表：每期本金 / 利息 / 剩余本金 */}
                {chartData ? (
                  <LineChart
                    height={260}
                    xLabels={chartData.xLabels}
                    series={[
                      { name: '当期本金', data: chartData.principal, color: '#3B82F6' },
                      { name: '当期利息', data: chartData.interest, color: '#F59E0B' },
                      { name: '剩余本金', data: chartData.remaining, color: '#10B981' },
                    ]}
                  />
                ) : (
                  <p className="text-text-tertiary text-sm">暂无还款计划</p>
                )}

                {/* 明细表格 */}
                <div className="mt-4 overflow-auto max-h-72">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>期次</TableHead>
                        <TableHead>到期日</TableHead>
                        <TableHead className="text-right">还款额</TableHead>
                        <TableHead className="text-right">本金</TableHead>
                        <TableHead className="text-right">利息</TableHead>
                        <TableHead className="text-right">剩余本金</TableHead>
                        <TableHead>状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedules.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-text-secondary">{s.seq}</TableCell>
                          <TableCell className="text-text-secondary whitespace-nowrap">{formatDate(s.dueDate, 'yyyy-MM-dd')}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(s.payment)}</TableCell>
                          <TableCell className="text-right text-text-secondary">{formatCurrency(s.principalPart)}</TableCell>
                          <TableCell className="text-right text-text-secondary">{formatCurrency(s.interestPart)}</TableCell>
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
              <EmptyState icon={<Landmark size={48} />} title="选择一笔贷款查看还款计划" />
            )}
          </Card>
        </div>
      )}

      {/* 新建贷款弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新建贷款</DialogTitle>
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
              <Label>贷款名称</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：房贷、车贷" />
            </div>
            <div>
              <Label>本金（元）</Label>
              <Input type="number" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <Label>年利率（%）</Label>
              <Input type="number" step="0.01" value={form.annualRate} onChange={(e) => setForm({ ...form, annualRate: e.target.value })} placeholder="如 4.2" />
            </div>
            <div>
              <Label>期限（月）</Label>
              <Input type="number" min={1} value={form.termMonths} onChange={(e) => setForm({ ...form, termMonths: e.target.value })} placeholder="如 360" />
            </div>
            <div>
              <Label>还款方式</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v as LoanMethod })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EQUAL_INSTALLMENT">等额本息</SelectItem>
                  <SelectItem value="EQUAL_PRINCIPAL">等额本金</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>首次还款日</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <Label>扣款账户（可选）</Label>
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

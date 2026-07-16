import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCurrentFamily } from '@/services/family.service';
import { getLedgers } from '@/services/ledger.service';
import { getAccounts } from '@/services/account.service';
import { useAuthStore } from '@/store/authStore';
import {
  listAdvances,
  registerAdvance,
  getAdvance,
  collectAdvance,
  deleteAdvance,
} from '@/services/advance.service';
import type { CreateAdvanceRequest, CollectAdvanceRequest } from '@/services/advance.service';
import { useToast } from '@/components/ui/toast';
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
import { formatCurrency, formatDate } from '@/lib/utils';
import type { DebtorType, AdvanceStatus } from '@/types/transaction';
import type { Ledger } from '@/types/family';
import type { Account } from '@/types/account';
import { Plus, ArrowUpRight, Trash2 } from 'lucide-react';

/**
 * 垫付管理页面
 * - 垫付列表：债务人/金额/已收回/剩余/状态
 * - 登记垫付表单（源 EXPENSE 交易 + AdvanceReceivable）
 * - 选中垫付：收回表单（金额 + 到账日 + 账户）
 */

const DEBTOR_TYPE_LABELS: Record<DebtorType, string> = {
  PERSON: '个人',
  COMPANY: '公司',
  FAMILY: '家庭',
};

const STATUS_LABELS: Record<AdvanceStatus, string> = {
  PENDING: '待收回',
  PARTIAL: '部分收回',
  RECOVERED: '已全部收回',
  CANCELLED: '已取消',
};

const STATUS_VARIANT: Record<AdvanceStatus, 'outline' | 'secondary' | 'default' | 'destructive'> = {
  PENDING: 'outline',
  PARTIAL: 'secondary',
  RECOVERED: 'default',
  CANCELLED: 'destructive',
};

interface AdvanceFormState {
  ledgerId: string;
  accountId: string;
  debtorName: string;
  debtorType: DebtorType;
  amount: string;
  dueDate: string;
  note: string;
}

const emptyForm = (ledgerId: string): AdvanceFormState => ({
  ledgerId,
  accountId: '',
  debtorName: '',
  debtorType: 'PERSON',
  amount: '',
  dueDate: '',
  note: '',
});

export function AdvancesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuthStore();

  const [familyId, setFamilyId] = useState<string>('');
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AdvanceFormState>(emptyForm(''));
  const [saving, setSaving] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collectOpen, setCollectOpen] = useState(false);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectDate, setCollectDate] = useState('');
  const [collectAccount, setCollectAccount] = useState('');
  const [collecting, setCollecting] = useState(false);

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

  // ===== 垫付列表 =====
  const { data: advances = [], isLoading, isError, error } = useQuery({
    queryKey: ['advances', familyId],
    queryFn: () => listAdvances(familyId),
    enabled: !!familyId,
  });

  // 选中明细
  const { data: selectedAdvance, isFetching: advanceFetching } = useQuery({
    queryKey: ['advance-detail', selectedId],
    queryFn: () => getAdvance(selectedId as string),
    enabled: !!selectedId,
  });

  useEffect(() => {
    if (!selectedId && advances.length > 0) setSelectedId(advances[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advances]);

  // ===== 登记垫付 =====
  const handleCreate = async () => {
    const amountNum = Number(form.amount);
    if (!form.ledgerId || !form.debtorName || !amountNum || !user?.id) {
      toast({ title: '请填写完整垫付信息', variant: 'destructive' });
      return;
    }
    const payload: CreateAdvanceRequest = {
      ledgerId: form.ledgerId,
      accountId: form.accountId || null,
      payerId: user.id,
      debtorName: form.debtorName,
      debtorType: form.debtorType,
      amount: amountNum,
      dueDate: form.dueDate || undefined,
      note: form.note || undefined,
    };
    setSaving(true);
    try {
      await registerAdvance(payload);
      toast({ title: '垫付已登记' });
      setDialogOpen(false);
      setForm(emptyForm(defaultLedgerId));
      queryClient.invalidateQueries({ queryKey: ['advances', familyId] });
    } catch (err: any) {
      toast({ title: '登记失败', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ===== 收回垫付 =====
  const openCollect = (adv: any) => {
    setSelectedId(adv.id);
    setCollectAmount('');
    setCollectDate(formatDate(new Date(), 'yyyy-MM-dd'));
    setCollectAccount(adv.accountId || accounts[0]?.id || '');
    setCollectOpen(true);
  };

  const handleCollect = async () => {
    if (!selectedId) return;
    const amountNum = Number(collectAmount);
    if (!amountNum || amountNum <= 0) {
      toast({ title: '请输入收回金额', variant: 'destructive' });
      return;
    }
    setCollecting(true);
    try {
      const res = await collectAdvance(selectedId, {
        amount: amountNum,
        date: new Date(collectDate).toISOString(),
        accountId: collectAccount || null,
      } as CollectAdvanceRequest);
      toast({ title: `已收回 ${formatCurrency(res.repaidAmount)}（剩 ${formatCurrency(res.remainingAmount)}）` });
      setCollectOpen(false);
      queryClient.invalidateQueries({ queryKey: ['advance-detail', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['advances', familyId] });
    } catch (err: any) {
      toast({ title: '收回失败', description: err?.message, variant: 'destructive' });
    } finally {
      setCollecting(false);
    }
  };

  // ===== 删除 =====
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdvance(id),
    onSuccess: () => {
      toast({ title: '垫付登记已删除' });
      if (selectedId) setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['advances', familyId] });
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
          <h1 className="text-2xl font-bold text-text-primary">垫付管理</h1>
          <p className="text-text-secondary mt-1">登记代垫支出并跟踪收回进度</p>
        </div>
        <Button size="sm" onClick={() => { setForm(emptyForm(defaultLedgerId)); setDialogOpen(true); }} disabled={!defaultLedgerId}>
          <Plus size={14} />
          登记垫付
        </Button>
      </div>

      {isLoading ? (
        <LoadingSpinner fullScreen />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh]">
          <p className="text-expense font-medium">加载失败</p>
          <p className="text-text-secondary mt-2">{(error as Error)?.message || '请检查网络'}</p>
        </div>
      ) : advances.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<ArrowUpRight size={48} />}
            title="暂无垫付"
            description="点击「登记垫付」添加一笔代垫支出"
            action={<Button onClick={() => { setForm(emptyForm(defaultLedgerId)); setDialogOpen(true); }}>登记垫付</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 左：垫付列表 */}
          <Card className="overflow-hidden lg:col-span-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>债务人</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advances.map((adv) => (
                  <TableRow
                    key={adv.id}
                    className={`cursor-pointer ${selectedId === adv.id ? 'bg-primary/5' : ''}`}
                    onClick={() => setSelectedId(adv.id)}
                  >
                    <TableCell>
                      <div className="font-medium text-text-primary">{adv.debtorName}</div>
                      <div className="text-xs text-text-tertiary">
                        {DEBTOR_TYPE_LABELS[adv.debtorType]} · 剩 {formatCurrency(adv.remainingAmount)}
                      </div>
                    </TableCell>
                    <TableCell className="text-text-secondary whitespace-nowrap">
                      {formatCurrency(adv.amount)}
                      <div className="text-xs text-text-tertiary">{STATUS_LABELS[adv.status]}</div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-expense hover:text-expense"
                        onClick={() => deleteMutation.mutate(adv.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* 右：收回 */}
          <Card className="p-4 lg:col-span-2">
            {advanceFetching ? (
              <LoadingSpinner />
            ) : selectedAdvance ? (
              <div>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">{selectedAdvance.debtorName}</h2>
                    <p className="text-sm text-text-secondary">
                      {DEBTOR_TYPE_LABELS[selectedAdvance.debtorType]} · 垫付 {formatCurrency(selectedAdvance.amount)} ·
                      已收回 {formatCurrency(selectedAdvance.repaidAmount)} · 剩 {formatCurrency(selectedAdvance.remainingAmount)}
                    </p>
                    {selectedAdvance.dueDate && (
                      <p className="text-xs text-text-tertiary">约定归还：{formatDate(selectedAdvance.dueDate, 'yyyy-MM-dd')}</p>
                    )}
                    <p className="text-xs text-text-tertiary">付款账户：{accountName(selectedAdvance.accountId)}</p>
                  </div>
                  <Button size="sm" onClick={() => openCollect(selectedAdvance)} disabled={selectedAdvance.status === 'RECOVERED' || selectedAdvance.status === 'CANCELLED'}>
                    <ArrowUpRight size={14} />
                    收回垫付
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-surface border border-border rounded-lg p-3">
                    <div className="text-xs text-text-tertiary">垫付总额</div>
                    <div className="text-base font-semibold text-text-primary">{formatCurrency(selectedAdvance.amount)}</div>
                  </div>
                  <div className="bg-surface border border-border rounded-lg p-3">
                    <div className="text-xs text-text-tertiary">已收回</div>
                    <div className="text-base font-semibold text-income">{formatCurrency(selectedAdvance.repaidAmount)}</div>
                  </div>
                  <div className="bg-surface border border-border rounded-lg p-3">
                    <div className="text-xs text-text-tertiary">剩余应收</div>
                    <div className="text-base font-semibold text-expense">{formatCurrency(selectedAdvance.remainingAmount)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[selectedAdvance.status]}>{STATUS_LABELS[selectedAdvance.status]}</Badge>
                  {selectedAdvance.note && (
                    <span className="text-xs text-text-tertiary">备注：{selectedAdvance.note}</span>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState icon={<ArrowUpRight size={48} />} title="选择一笔垫付查看详情" />
            )}
          </Card>
        </div>
      )}

      {/* 登记垫付弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>登记垫付</DialogTitle>
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
              <Label>债务人姓名</Label>
              <Input value={form.debtorName} onChange={(e) => setForm({ ...form, debtorName: e.target.value })} placeholder="如：张三、某公司" />
            </div>
            <div>
              <Label>债务人类型</Label>
              <Select value={form.debtorType} onValueChange={(v) => setForm({ ...form, debtorType: v as DebtorType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERSON">个人</SelectItem>
                  <SelectItem value="COMPANY">公司</SelectItem>
                  <SelectItem value="FAMILY">家庭</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>垫付金额（元）</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <Label>约定归还日（可选）</Label>
              <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div>
              <Label>付款账户（可选）</Label>
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
              {saving ? '登记中…' : '登记'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 收回垫付弹窗 */}
      <Dialog open={collectOpen} onOpenChange={setCollectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>收回垫付</DialogTitle>
          </DialogHeader>
          {selectedAdvance && (
            <div className="py-2 space-y-3">
              <div className="text-sm text-text-secondary">
                债务人：<span className="font-medium text-text-primary">{selectedAdvance.debtorName}</span>
                {' '}· 剩余应收 <span className="font-medium">{formatCurrency(selectedAdvance.remainingAmount)}</span>
              </div>
              <div>
                <Label>本次收回金额</Label>
                <Input type="number" value={collectAmount} onChange={(e) => setCollectAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <Label>到账日期</Label>
                <Input type="date" value={collectDate} onChange={(e) => setCollectDate(e.target.value)} />
              </div>
              <div>
                <Label>入账账户</Label>
                <Select value={collectAccount} onValueChange={setCollectAccount}>
                  <SelectTrigger><SelectValue placeholder="选择入账账户" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCollectOpen(false)}>取消</Button>
            <Button onClick={handleCollect} disabled={collecting}>
              {collecting ? '处理中…' : '确认收回'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

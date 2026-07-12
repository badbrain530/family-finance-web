import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCurrentFamily, getFamilyMembers } from '@/services/family.service';
import { getAccounts } from '@/services/account.service';
import {
  getTransactions,
  confirmReimbursement,
  cancelReimbursement,
} from '@/services/transaction.service';
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
import { AmountText } from '@/components/common/AmountText';
import { formatCurrency, formatDate } from '@/lib/utils';
import { type Transaction } from '@/types/transaction';
import type { FamilyMember } from '@/types/family';
import type { Account } from '@/types/account';
import { HandCoins, CheckCircle2, XCircle } from 'lucide-react';

/**
 * 报销管理页面
 * - 待报销 / 已报销 清单（按 reimbursementStatus 拉取）
 * - 展示：交易摘要 / 金额 / 垫付人 / 来源(metadata.reimbursementSource) / 状态
 * - 操作：确认报销（选到账账户 + 日期）、取消
 * - 可按成员 / 状态筛选
 */

type TabStatus = 'PENDING' | 'REIMBURSED';

export function ReimbursementsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [familyId, setFamilyId] = useState<string>('');
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [tab, setTab] = useState<TabStatus>('PENDING');
  const [filterMember, setFilterMember] = useState<string>('all');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTx, setConfirmTx] = useState<Transaction | null>(null);
  const [confirmDate, setConfirmDate] = useState('');
  const [confirmAccount, setConfirmAccount] = useState('');
  const [confirmNote, setConfirmNote] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const family = await getCurrentFamily();
        setFamilyId(family.id);
        const [memberList, accList] = await Promise.all([
          getFamilyMembers(family.id),
          getAccounts(family.id),
        ]);
        setMembers(memberList);
        setAccounts(accList);
      } catch (err: any) {
        toast({ title: '加载基础数据失败', description: err?.message, variant: 'destructive' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 按状态拉取报销交易
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['reimbursements', familyId, tab],
    queryFn: () =>
      getTransactions({ reimbursementStatus: tab, pageSize: 200 }),
    enabled: !!familyId,
  });

  const allItems: Transaction[] = data?.items || [];

  const filteredItems = useMemo(() => {
    if (filterMember === 'all') return allItems;
    return allItems.filter((tx) => tx.userId === filterMember);
  }, [allItems, filterMember]);

  const pendingCount = useMemo(
    () => (tab === 'PENDING' ? allItems.length : 0),
    [tab, allItems],
  );

  // ===== 确认报销 =====
  const openConfirm = (tx: Transaction) => {
    setConfirmTx(tx);
    setConfirmDate(formatDate(new Date(), 'yyyy-MM-dd'));
    setConfirmAccount(tx.accountId || accounts[0]?.id || '');
    setConfirmNote('');
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!confirmTx) return;
    if (!confirmDate) {
      toast({ title: '请选择到账日期', variant: 'destructive' });
      return;
    }
    setActing(true);
    try {
      await confirmReimbursement(confirmTx.id, {
        date: new Date(confirmDate).toISOString(),
        accountId: confirmAccount || null,
        note: confirmNote || undefined,
      });
      toast({ title: '报销已确认' });
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['reimbursements', familyId] });
    } catch (err: any) {
      toast({ title: '确认失败', description: err?.message, variant: 'destructive' });
    } finally {
      setActing(false);
    }
  };

  // ===== 取消报销 =====
  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelReimbursement(id),
    onSuccess: () => {
      toast({ title: '已取消待报销标记' });
      queryClient.invalidateQueries({ queryKey: ['reimbursements', familyId] });
    },
    onError: (err: any) =>
      toast({ title: '取消失败', description: err?.message, variant: 'destructive' }),
  });

  const memberName = (userId?: string) =>
    members.find((m) => m.userId === userId)?.user?.nickname || '未知成员';

  const sourceLabel = (tx: Transaction) => {
    const src = tx.metadata?.reimbursementSource;
    if (src === 'family') return '家庭账户';
    if (src === 'company') return '公司/外部';
    return src || '—';
  };

  const TABS: { key: TabStatus; label: string }[] = [
    { key: 'PENDING', label: '待报销' },
    { key: 'REIMBURSED', label: '已报销' },
  ];

  return (
    <div className="page-container">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">报销管理</h1>
        <p className="text-text-secondary mt-1">管理家庭成员垫付费用的报销确认</p>
      </div>

      {/* Tab + 筛选 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <Button
              key={t.key}
              variant={tab === t.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {t.key === 'PENDING' && pendingCount > 0 && (
                <Badge variant="secondary" className="ml-1">{pendingCount}</Badge>
              )}
            </Button>
          ))}
        </div>
        <Select value={filterMember} onValueChange={setFilterMember}>
          <SelectTrigger className="w-40"><SelectValue placeholder="全部成员" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部成员</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.user?.nickname || m.userId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingSpinner fullScreen />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh]">
          <p className="text-expense font-medium">加载失败</p>
          <p className="text-text-secondary mt-2">{(error as Error)?.message || '请检查网络'}</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<HandCoins size={48} />}
            title={tab === 'PENDING' ? '暂无待报销记录' : '暂无已报销记录'}
            description="标记交易为待报销后会出现在这里"
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>交易摘要</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead>垫付人</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>
                    <div className="font-medium text-text-primary">{tx.merchant || '未命名'}</div>
                    <div className="text-xs text-text-tertiary">
                      {formatDate(tx.date, 'yyyy-MM-dd')}
                      {tx.note ? ` · ${tx.note}` : ''}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <AmountText amount={tx.amount} type={tx.type} />
                  </TableCell>
                  <TableCell className="text-text-secondary">{memberName(tx.userId)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{sourceLabel(tx)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={tx.reimbursementStatus === 'REIMBURSED' ? 'default' : 'secondary'}>
                      {tx.reimbursementStatus === 'REIMBURSED' ? '已报销' : '待报销'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {tx.reimbursementStatus === 'PENDING' ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="text-income hover:text-income" onClick={() => openConfirm(tx)}>
                          <CheckCircle2 size={14} />
                          确认
                        </Button>
                        <Button variant="ghost" size="sm" className="text-expense hover:text-expense" onClick={() => cancelMutation.mutate(tx.id)}>
                          <XCircle size={14} />
                          取消
                        </Button>
                      </div>
                    ) : (
                      <span className="text-text-tertiary text-xs">已完成</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* 确认报销弹窗 */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认报销</DialogTitle>
          </DialogHeader>
          {confirmTx && (
            <div className="py-2 space-y-3">
              <div className="text-sm text-text-secondary">
                报销交易：<span className="font-medium text-text-primary">{confirmTx.merchant || '未命名'}</span>
                {' '}· 金额 <span className="font-medium">{formatCurrency(confirmTx.amount)}</span>
              </div>
              <div>
                <Label>到账账户</Label>
                <Select value={confirmAccount} onValueChange={setConfirmAccount}>
                  <SelectTrigger><SelectValue placeholder="选择到账账户" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>到账日期</Label>
                <Input type="date" value={confirmDate} onChange={(e) => setConfirmDate(e.target.value)} />
              </div>
              <div>
                <Label>备注（可选）</Label>
                <Input value={confirmNote} onChange={(e) => setConfirmNote(e.target.value)} placeholder="如：公司财务报销" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>取消</Button>
            <Button onClick={handleConfirm} disabled={acting}>
              {acting ? '处理中…' : '确认报销'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

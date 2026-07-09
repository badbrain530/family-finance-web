import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  Copy,
  Crown,
  Shield,
  Eye,
  Wallet,
  TrendingUp,
  TrendingDown,
  BookOpen,
  Plus,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar } from '@/components/ui/avatar';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { AmountText } from '@/components/common/AmountText';
import { CategoryTag } from '@/components/common/CategoryTag';
import { useToast } from '@/components/ui/toaster';
import { useAuthStore } from '@/store/authStore';
import { getCurrentFamily, createFamily } from '@/services/family.service';
import { getLedgers, createLedger } from '@/services/ledger.service';
import { cn, formatCurrency, formatDate, copyToClipboard } from '@/lib/utils';
import { MemberRole, LedgerType } from '@/types/family';
import type { Transaction, TransactionType } from '@/types/transaction';

/**
 * 家庭账本页面
 * 成员卡片 + 共享收支表格 + 邀请成员 + 真实账本管理
 */

// 角色配置
const ROLE_CONFIG: Record<MemberRole, { label: string; icon: typeof Crown; color: string }> = {
  [MemberRole.OWNER]: { label: '创建者', icon: Crown, color: 'text-budget-warning' },
  [MemberRole.ADMIN]: { label: '管理员', icon: Shield, color: 'text-primary' },
  [MemberRole.MEMBER]: { label: '成员', icon: Users, color: 'text-text-secondary' },
  [MemberRole.VIEWER]: { label: '访客', icon: Eye, color: 'text-text-tertiary' },
};

export function FamilyLedgerPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  // TanStack Query 获取家庭数据
  const { data: familyData } = useQuery({
    queryKey: ['family'],
    queryFn: async () => {
      // TODO: 接入真实 API
      return { members: [], transactions: [] };
    },
  });

  // 当前家庭（用于真实账本管理）
  const { data: family, isLoading: familyLoading } = useQuery({
    queryKey: ['currentFamily'],
    queryFn: () => getCurrentFamily(),
  });

  // 真实账本列表（命中后端 /api/ledgers?familyId=xxx）
  const {
    data: ledgers,
    isLoading: ledgersLoading,
    refetch: refetchLedgers,
  } = useQuery({
    queryKey: ['ledgers', family?.id],
    queryFn: () => getLedgers(family!.id),
    enabled: !!family?.id,
  });

  // 账本新建相关状态
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newLedgerName, setNewLedgerName] = useState('');
  const [creatingLedger, setCreatingLedger] = useState(false);

  // 创建家庭相关状态（无家庭时的入口，闭合"被引导建家庭却无入口"的死路）
  const [showCreateFamilyInput, setShowCreateFamilyInput] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');

  const createFamilyMutation = useMutation({
    mutationFn: (name: string) => createFamily({ name }),
    onSuccess: () => {
      // 家庭创建成功后，重新拉取当前家庭，使"我的账本"/"邀请成员"等随之可用
      queryClient.invalidateQueries({ queryKey: ['currentFamily'] });
      setShowCreateFamilyInput(false);
      setNewFamilyName('');
      toast({
        title: '家庭已创建',
        description: '现在可以创建账本、邀请成员一起记账了',
        variant: 'success',
      });
    },
    onError: (err: any) => {
      toast({
        title: '创建家庭失败',
        description: err?.message || '请稍后重试',
        variant: 'destructive',
      });
    },
  });

  // 暂用常量（后续移除）
  const mockMembers = [
    { id: 'u1', nickname: '我', role: MemberRole.OWNER, avatar: null, expense: 8200, income: 18500, txCount: 45, isOnline: true },
    { id: 'u2', nickname: '伴侣', role: MemberRole.ADMIN, avatar: null, expense: 4180.5, income: 0, txCount: 28, isOnline: true },
    { id: 'u3', nickname: '妈妈', role: MemberRole.MEMBER, avatar: null, expense: 0, income: 0, txCount: 0, isOnline: false },
  ];
  const mockSharedTransactions: Transaction[] = [
    { id: '1', ledgerId: 'l1', userId: 'u1', categoryId: 'c1', type: 'expense' as TransactionType, amount: 35.5, date: '2026-07-04T12:30:00Z', merchant: '美团外卖', note: '午餐', source: 'quick_record' as any, importRecordId: null, aiConfidence: 0.92, aiCorrected: false, isLargeExpense: false, createdAt: '', updatedAt: '', currency: 'CNY', metadata: null, tags: [], category: { id: 'c1', name: '在外就餐', color: '#FF5252', familyId: '', parentId: null, icon: '', sortOrder: 0, isSystem: true, createdAt: '' }, user: { id: 'u1', nickname: '我', phone: null, email: null, wechatOpenId: null, avatar: null, createdAt: '', updatedAt: '' } },
    { id: '2', ledgerId: 'l1', userId: 'u1', categoryId: 'c2', type: 'income' as TransactionType, amount: 18500, date: '2026-07-01T09:00:00Z', merchant: '公司', note: '7月工资', source: 'manual' as any, importRecordId: null, aiConfidence: null, aiCorrected: false, isLargeExpense: false, createdAt: '', updatedAt: '', currency: 'CNY', metadata: null, tags: [], category: { id: 'c2', name: '基本工资', color: '#3B82F6', familyId: '', parentId: null, icon: '', sortOrder: 0, isSystem: true, createdAt: '' }, user: { id: 'u1', nickname: '我', phone: null, email: null, wechatOpenId: null, avatar: null, createdAt: '', updatedAt: '' } },
    { id: '3', ledgerId: 'l1', userId: 'u2', categoryId: 'c3', type: 'expense' as TransactionType, amount: 1280, date: '2026-07-03T18:00:00Z', merchant: '华润万家', note: '周末采购', source: 'manual' as any, importRecordId: null, aiConfidence: 0.88, aiCorrected: false, isLargeExpense: true, createdAt: '', updatedAt: '', currency: 'CNY', metadata: null, tags: [], category: { id: 'c3', name: '米面粮油', color: '#FF6B6B', familyId: '', parentId: null, icon: '', sortOrder: 0, isSystem: true, createdAt: '' }, user: { id: 'u2', nickname: '伴侣', phone: null, email: null, wechatOpenId: null, avatar: null, createdAt: '', updatedAt: '' } },
    { id: '4', ledgerId: 'l1', userId: 'u2', categoryId: 'c4', type: 'expense' as TransactionType, amount: 120, date: '2026-07-02T20:00:00Z', merchant: '万达影院', note: '看电影', source: 'manual' as any, importRecordId: null, aiConfidence: 0.9, aiCorrected: true, isLargeExpense: false, createdAt: '', updatedAt: '', currency: 'CNY', metadata: null, tags: [], category: { id: 'c4', name: '文化娱乐', color: '#C48EC4', familyId: '', parentId: null, icon: '', sortOrder: 0, isSystem: true, createdAt: '' }, user: { id: 'u2', nickname: '伴侣', phone: null, email: null, wechatOpenId: null, avatar: null, createdAt: '', updatedAt: '' } },
  ];

  const members = familyData?.members || mockMembers;
  const sharedTransactions = familyData?.transactions || mockSharedTransactions;

  const handleCopyInvite = async () => {
    const success = await copyToClipboard('8KQ2X9');
    if (success) {
      toast({
        title: '邀请码已复制',
        description: '分享给家人，注册后输入即可加入',
        variant: 'success',
      });
    }
  };

  // 新建账本
  const handleCreateLedger = async () => {
    if (!family) {
      toast({
        title: '无法创建',
        description: '未获取到家庭信息，请刷新后重试',
        variant: 'destructive',
      });
      return;
    }
    const name = newLedgerName.trim() || '家庭账本';
    setCreatingLedger(true);
    try {
      await createLedger(family.id, name, LedgerType.SHARED);
      setNewLedgerName('');
      setShowCreateInput(false);
      await refetchLedgers();
      toast({
        title: '账本已创建',
        description: `已创建「${name}」`,
        variant: 'success',
      });
    } catch (err: any) {
      toast({
        title: '创建账本失败',
        description: err?.message || '请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setCreatingLedger(false);
    }
  };

  // 创建家庭
  const handleCreateFamily = () => {
    const name = newFamilyName.trim();
    if (!name) {
      toast({
        title: '请输入家庭名称',
        variant: 'destructive',
      });
      return;
    }
    createFamilyMutation.mutate(name);
  };

  // 汇总
  const totalExpense = members.reduce((sum: number, m: any) => sum + m.expense, 0);
  const totalIncome = members.reduce((sum: number, m: any) => sum + m.income, 0);
  const onlineCount = members.filter((m: any) => m.isOnline).length;

  return (
    <div className="page-container">
      {/* 标题栏 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">家庭协同</h1>
          <p className="text-text-secondary mt-1">
            {onlineCount} 人在线 · 共 {members.length} 位成员
          </p>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)}>
          <UserPlus size={16} />
          邀请成员
        </Button>
      </div>

      {/* 空状态：尚未创建/加入家庭 —— 提供"创建家庭"入口，闭合引导死路 */}
      {!familyLoading && !family && (
        <Card className="mb-6 border-dashed border-primary-200 bg-primary-50/40">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                <Users size={22} className="text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text-primary">你还没有家庭</h2>
                <p className="text-sm text-text-secondary mt-1">
                  创建家庭后即可管理共享账本、邀请成员一起记账
                </p>
              </div>
            </div>
            <Button onClick={() => setShowCreateFamilyInput(true)} className="shrink-0">
              <Plus size={16} />
              创建家庭
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 汇总卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6">
        <Card className="p-4 md:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs md:text-sm text-text-secondary">家庭总收入</span>
            <div className="w-9 h-9 rounded-lg bg-income/10 flex items-center justify-center">
              <TrendingUp size={18} className="text-income" />
            </div>
          </div>
          <p className="text-xl md:text-2xl font-bold text-income tabular-nums">
            {formatCurrency(totalIncome)}
          </p>
        </Card>
        <Card className="p-4 md:p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs md:text-sm text-text-secondary">家庭总支出</span>
            <div className="w-9 h-9 rounded-lg bg-expense/10 flex items-center justify-center">
              <TrendingDown size={18} className="text-expense" />
            </div>
          </div>
          <p className="text-xl md:text-2xl font-bold text-expense tabular-nums">
            {formatCurrency(totalExpense)}
          </p>
        </Card>
        <Card className="p-4 md:p-5 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs md:text-sm text-text-secondary">家庭结余</span>
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet size={18} className="text-primary" />
            </div>
          </div>
          <p className="text-xl md:text-2xl font-bold text-primary tabular-nums">
            {formatCurrency(totalIncome - totalExpense)}
          </p>
        </Card>
      </div>

      {/* 我的账本（真实账本管理，避免引用不存在的"账本管理"页） */}
      <Card className="mb-6">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen size={16} className="text-primary" />
            我的账本
          </CardTitle>
          {!showCreateInput && (
            <Button size="sm" variant="outline" onClick={() => setShowCreateInput(true)}>
              <Plus size={14} />
              新建账本
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {familyLoading || ledgersLoading ? (
            <div className="px-6 py-8 flex items-center justify-center gap-2 text-sm text-text-tertiary">
              <Loader2 size={14} className="animate-spin" />
              加载中…
            </div>
          ) : ledgers && ledgers.length > 0 ? (
            <ul className="divide-y divide-border">
              {ledgers.map((ledger) => (
                <li key={ledger.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen size={14} className="text-text-tertiary" />
                    <span className="text-sm text-text-primary">{ledger.name}</span>
                  </div>
                  <Badge variant={ledger.type === LedgerType.SHARED ? 'default' : 'secondary'}>
                    {ledger.type === LedgerType.SHARED ? '共享' : '个人'}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-8 text-center">
              <p className="text-sm text-text-secondary mb-1">还没有账本</p>
              <p className="text-xs text-text-tertiary mb-4">创建账本后即可在快捷记账中使用</p>
              <Button size="sm" onClick={() => setShowCreateInput(true)}>
                <Plus size={14} />
                新建账本
              </Button>
            </div>
          )}

          {showCreateInput && (
            <div className="px-6 py-4 border-t border-border flex items-center gap-2">
              <Input
                value={newLedgerName}
                onChange={(e) => setNewLedgerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateLedger();
                }}
                placeholder="家庭账本"
                className="flex-1"
                autoFocus
              />
              <Button size="sm" onClick={handleCreateLedger} disabled={creatingLedger}>
                {creatingLedger ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                创建
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowCreateInput(false);
                  setNewLedgerName('');
                }}
              >
                取消
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 成员卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {members.map((member: any) => {
          const roleConfig = ROLE_CONFIG[member.role as MemberRole];
          const RoleIcon = roleConfig.icon;
          return (
            <Card key={member.id} className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar src={member.avatar} fallback={member.nickname} size="lg" />
                    {member.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-income border-2 border-surface" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-text-primary">
                      {member.nickname}
                      {member.id === user?.id && <span className="text-xs text-text-tertiary ml-1">(我)</span>}
                    </h3>
                    <div className={cn('flex items-center gap-1 text-xs', roleConfig.color)}>
                      <RoleIcon size={12} />
                      {roleConfig.label}
                    </div>
                  </div>
                </div>
                {!member.isOnline && (
                  <Badge variant="outline" className="text-xs">离线</Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-primary-50/30">
                  <div className="text-xs text-text-tertiary">记账</div>
                  <div className="text-sm font-semibold text-text-primary">{member.txCount}</div>
                </div>
                <div className="p-2 rounded-lg bg-income/5">
                  <div className="text-xs text-text-tertiary">收入</div>
                  <div className="text-sm font-semibold text-income tabular-nums">{formatCurrency(member.income)}</div>
                </div>
                <div className="p-2 rounded-lg bg-expense/5">
                  <div className="text-xs text-text-tertiary">支出</div>
                  <div className="text-sm font-semibold text-expense tabular-nums">{formatCurrency(member.expense)}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 共享收支表格 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">共享收支记录</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日期</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>记账人</TableHead>
                <TableHead className="text-right">金额</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sharedTransactions.map((tx: any) => (
                <TableRow key={tx.id} className="cursor-pointer">
                  <TableCell className="text-text-secondary whitespace-nowrap text-sm">
                    {formatDate(tx.date, 'MM-dd HH:mm')}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium text-text-primary">
                      {tx.merchant || '未命名'}
                    </div>
                    {tx.note && <div className="text-xs text-text-tertiary">{tx.note}</div>}
                  </TableCell>
                  <TableCell>
                    <CategoryTag category={tx.category} />
                  </TableCell>
                  <TableCell className="text-sm text-text-secondary">
                    {tx.user?.nickname || '未知'}
                  </TableCell>
                  <TableCell className="text-right">
                    <AmountText amount={tx.amount} type={tx.type} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 邀请成员弹窗 */}
      {inviteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setInviteDialogOpen(false)}>
          <Card className="w-full max-w-md p-6" >
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                  <UserPlus size={20} className="text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-text-primary">邀请家庭成员</h2>
              </div>

              <div className="p-6 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100/50 text-center mb-4">
                <p className="text-sm text-text-secondary mb-3">家庭邀请码</p>
                <div className="text-3xl font-bold text-primary tracking-widest mb-2">8KQ2X9</div>
                <p className="text-xs text-text-tertiary">邀请码7天内有效</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setInviteDialogOpen(false)}>
                  关闭
                </Button>
                <Button className="flex-1" onClick={handleCopyInvite}>
                  <Copy size={14} />
                  复制邀请码
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 创建家庭弹窗（无家庭时的入口，闭合死路） */}
      {showCreateFamilyInput && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowCreateFamilyInput(false)}
        >
          <Card className="w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                <Users size={20} className="text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-text-primary">创建家庭</h2>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              为你的家庭起个名字，创建后即可共享账本、邀请成员一起记账。
            </p>
            <div className="space-y-2 mb-4">
              <Label htmlFor="newFamilyName">家庭名称</Label>
              <Input
                id="newFamilyName"
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFamily();
                }}
                placeholder="例如：张家的小日子"
                className="flex-1"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowCreateFamilyInput(false);
                  setNewFamilyName('');
                }}
                disabled={createFamilyMutation.isPending}
              >
                取消
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreateFamily}
                disabled={createFamilyMutation.isPending || !newFamilyName.trim()}
              >
                {createFamilyMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                创建
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}

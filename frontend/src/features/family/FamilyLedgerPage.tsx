import { useState } from 'react';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { cn, formatCurrency, formatDate, copyToClipboard } from '@/lib/utils';
import { MemberRole } from '@/types/family';
import type { Transaction, TransactionType } from '@/types/transaction';

/**
 * 家庭账本页面
 * 成员卡片 + 共享收支表格 + 邀请成员
 */

// 角色配置
const ROLE_CONFIG: Record<MemberRole, { label: string; icon: typeof Crown; color: string }> = {
  [MemberRole.OWNER]: { label: '创建者', icon: Crown, color: 'text-budget-warning' },
  [MemberRole.ADMIN]: { label: '管理员', icon: Shield, color: 'text-primary' },
  [MemberRole.MEMBER]: { label: '成员', icon: Users, color: 'text-text-secondary' },
  [MemberRole.VIEWER]: { label: '访客', icon: Eye, color: 'text-text-tertiary' },
};

// 模拟成员数据
const mockMembers = [
  { id: 'u1', nickname: '我', role: MemberRole.OWNER, avatar: null, expense: 8200, income: 18500, txCount: 45, isOnline: true },
  { id: 'u2', nickname: '伴侣', role: MemberRole.ADMIN, avatar: null, expense: 4180.5, income: 0, txCount: 28, isOnline: true },
  { id: 'u3', nickname: '妈妈', role: MemberRole.MEMBER, avatar: null, expense: 0, income: 0, txCount: 0, isOnline: false },
];

// 模拟共享交易数据
const mockSharedTransactions: Transaction[] = [
  { id: '1', ledgerId: 'l1', userId: 'u1', categoryId: 'c1', type: 'expense' as TransactionType, amount: 35.5, date: '2026-07-04T12:30:00Z', merchant: '美团外卖', note: '午餐', source: 'quick_record' as any, importRecordId: null, aiConfidence: 0.92, aiCorrected: false, isLargeExpense: false, createdAt: '', updatedAt: '', currency: 'CNY', metadata: null, tags: [], category: { id: 'c1', name: '在外就餐', color: '#FF5252', familyId: '', parentId: null, icon: '', sortOrder: 0, isSystem: true, createdAt: '' }, user: { id: 'u1', nickname: '我', phone: null, email: null, wechatOpenId: null, avatar: null, createdAt: '', updatedAt: '' } },
  { id: '2', ledgerId: 'l1', userId: 'u1', categoryId: 'c2', type: 'income' as TransactionType, amount: 18500, date: '2026-07-01T09:00:00Z', merchant: '公司', note: '7月工资', source: 'manual' as any, importRecordId: null, aiConfidence: null, aiCorrected: false, isLargeExpense: false, createdAt: '', updatedAt: '', currency: 'CNY', metadata: null, tags: [], category: { id: 'c2', name: '基本工资', color: '#00C896', familyId: '', parentId: null, icon: '', sortOrder: 0, isSystem: true, createdAt: '' }, user: { id: 'u1', nickname: '我', phone: null, email: null, wechatOpenId: null, avatar: null, createdAt: '', updatedAt: '' } },
  { id: '3', ledgerId: 'l1', userId: 'u2', categoryId: 'c3', type: 'expense' as TransactionType, amount: 1280, date: '2026-07-03T18:00:00Z', merchant: '华润万家', note: '周末采购', source: 'manual' as any, importRecordId: null, aiConfidence: 0.88, aiCorrected: false, isLargeExpense: true, createdAt: '', updatedAt: '', currency: 'CNY', metadata: null, tags: [], category: { id: 'c3', name: '米面粮油', color: '#FF6B6B', familyId: '', parentId: null, icon: '', sortOrder: 0, isSystem: true, createdAt: '' }, user: { id: 'u2', nickname: '伴侣', phone: null, email: null, wechatOpenId: null, avatar: null, createdAt: '', updatedAt: '' } },
  { id: '4', ledgerId: 'l1', userId: 'u2', categoryId: 'c4', type: 'expense' as TransactionType, amount: 120, date: '2026-07-02T20:00:00Z', merchant: '万达影院', note: '看电影', source: 'manual' as any, importRecordId: null, aiConfidence: 0.9, aiCorrected: true, isLargeExpense: false, createdAt: '', updatedAt: '', currency: 'CNY', metadata: null, tags: [], category: { id: 'c4', name: '文化娱乐', color: '#C48EC4', familyId: '', parentId: null, icon: '', sortOrder: 0, isSystem: true, createdAt: '' }, user: { id: 'u2', nickname: '伴侣', phone: null, email: null, wechatOpenId: null, avatar: null, createdAt: '', updatedAt: '' } },
];

export function FamilyLedgerPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

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

  // 汇总
  const totalExpense = mockMembers.reduce((sum, m) => sum + m.expense, 0);
  const totalIncome = mockMembers.reduce((sum, m) => sum + m.income, 0);
  const onlineCount = mockMembers.filter((m) => m.isOnline).length;

  return (
    <div className="page-container">
      {/* 标题栏 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">家庭协同</h1>
          <p className="text-text-secondary mt-1">
            {onlineCount} 人在线 · 共 {mockMembers.length} 位成员
          </p>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)}>
          <UserPlus size={16} />
          邀请成员
        </Button>
      </div>

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

      {/* 成员卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {mockMembers.map((member) => {
          const roleConfig = ROLE_CONFIG[member.role];
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
              {mockSharedTransactions.map((tx) => (
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
    </div>
  );
}

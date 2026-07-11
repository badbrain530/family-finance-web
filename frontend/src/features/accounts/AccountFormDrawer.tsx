import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
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
import { useToast } from '@/components/ui/toaster';
import {
  createAccount,
  updateAccount,
  deactivateAccount,
} from '@/services/account.service';
import { getCurrentFamily } from '@/services/family.service';
import { ACCOUNT_TYPE_META, ACCOUNT_TYPE_ORDER } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { AccountType } from '@/types/account';
import type { Account, CreateAccountRequest, UpdateAccountRequest } from '@/types/account';

/**
 * 新建/编辑账户抽屉（采用 Dialog 承载，按类型动态渲染字段）
 */
interface AccountFormDrawerProps {
  familyId?: string;
  account: Account | null; // 有值=编辑，无值=新建
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/** 计算距还款日天数（短月按当月最后一天计，避免 29~31 号溢出到下月） */
function daysUntilDue(paymentDueDay: number | null): number | null {
  if (!paymentDueDay) return null;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(paymentDueDay, daysInMonth);
  let due = new Date(year, month, day);
  if (due < now) {
    // 已过期则算下个月，下个月同样按短月兜底
    const ny = month === 11 ? year + 1 : year;
    const nm = (month + 1) % 12;
    const nDays = new Date(ny, nm + 1, 0).getDate();
    due = new Date(ny, nm, Math.min(paymentDueDay, nDays));
  }
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export function AccountFormDrawer({
  familyId: familyIdProp,
  account,
  open,
  onOpenChange,
  onSaved,
}: AccountFormDrawerProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const isEdit = !!account;

  // 运行时解析 familyId：优先用外部传入；缺失时再调 getCurrentFamily 兜底
  // （容错 AccountsPage.family 过期为 null 的情况），始终保证抽屉可弹出
  const [resolvedFamilyId, setResolvedFamilyId] = useState<string | undefined>(familyIdProp);
  const [familyLoading, setFamilyLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (familyIdProp) {
      setResolvedFamilyId(familyIdProp);
      return;
    }
    let cancelled = false;
    setFamilyLoading(true);
    getCurrentFamily()
      .then((fam) => {
        if (!cancelled) setResolvedFamilyId(fam.id);
      })
      .catch(() => {
        if (!cancelled) setResolvedFamilyId(undefined);
      })
      .finally(() => {
        if (!cancelled) setFamilyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, familyIdProp]);

  // 表单状态
  const [type, setType] = useState<AccountType>(AccountType.DEBIT);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [institution, setInstitution] = useState('');
  const [lastFourDigits, setLastFourDigits] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [billingDay, setBillingDay] = useState('');
  const [paymentDueDay, setPaymentDueDay] = useState('');
  const [platform, setPlatform] = useState('');
  const [purpose, setPurpose] = useState('');
  const [saving, setSaving] = useState(false);

  // 打开时填充（编辑场景）
  useEffect(() => {
    if (open && account) {
      setType(account.type);
      setName(account.name);
      setBalance(String(account.balance));
      setInstitution(account.institution || '');
      setLastFourDigits(account.lastFourDigits || '');
      setCreditLimit(account.creditLimit != null ? String(account.creditLimit) : '');
      setBillingDay(account.billingDay != null ? String(account.billingDay) : '');
      setPaymentDueDay(account.paymentDueDay != null ? String(account.paymentDueDay) : '');
      setPlatform(account.platform || '');
      setPurpose(account.purpose || '');
    } else if (open && !account) {
      // 新建：重置
      setType(AccountType.DEBIT);
      setName('');
      setBalance('');
      setInstitution('');
      setLastFourDigits('');
      setCreditLimit('');
      setBillingDay('');
      setPaymentDueDay('');
      setPlatform('');
      setPurpose('');
    }
  }, [open, account]);

  const handleSave = async () => {
    if (!resolvedFamilyId) {
      toast({ title: '请先在「家庭协同」页创建家庭', variant: 'destructive' });
      return;
    }
    if (!name.trim()) {
      toast({ title: '请输入账户名称', variant: 'destructive' });
      return;
    }
    const numBalance = parseFloat(balance);
    if (isNaN(numBalance) || numBalance < 0) {
      toast({ title: '请输入有效的余额/欠款', variant: 'destructive' });
      return;
    }
    if (type === AccountType.CREDIT) {
      const cl = parseFloat(creditLimit);
      if (isNaN(cl) || cl < 0) {
        toast({ title: '信用卡需填写有效的授信额度', variant: 'destructive' });
        return;
      }
    }

    const base: CreateAccountRequest = {
      familyId: resolvedFamilyId,
      type,
      name: name.trim(),
      balance: numBalance,
      institution: institution.trim() || undefined,
      lastFourDigits: lastFourDigits.trim() || undefined,
      creditLimit: type === AccountType.CREDIT ? parseFloat(creditLimit) : undefined,
      billingDay: billingDay ? parseInt(billingDay, 10) : undefined,
      paymentDueDay: paymentDueDay ? parseInt(paymentDueDay, 10) : undefined,
      platform: platform.trim() || undefined,
      purpose: purpose.trim() || undefined,
    };

    setSaving(true);
    try {
      if (isEdit && account) {
        const patch: UpdateAccountRequest = { ...base };
        delete (patch as any).familyId;
        await updateAccount(account.id, patch);
        toast({ title: '账户已更新', variant: 'success' });
      } else {
        await createAccount(base);
        toast({ title: '账户已创建', variant: 'success' });
      }
      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast({ title: '保存失败', description: err?.message || '请重试', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!account) return;
    try {
      await deactivateAccount(account.id);
      toast({
        title: account.isActive ? '账户已停用' : '账户已启用',
        variant: 'success',
      });
      onSaved();
    } catch (err: any) {
      toast({ title: '操作失败', description: err?.message, variant: 'destructive' });
    }
  };

  // 信用卡实时预览
  const previewAvailable =
    type === AccountType.CREDIT && creditLimit && balance
      ? parseFloat(creditLimit) - parseFloat(balance)
      : null;
  const previewDueDays = type === AccountType.CREDIT ? daysUntilDue(paymentDueDay ? parseInt(paymentDueDay, 10) : null) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑账户' : '添加账户'}</DialogTitle>
        </DialogHeader>

        {!resolvedFamilyId ? (
          familyLoading ? (
            <div className="py-8 text-center text-text-secondary">加载中...</div>
          ) : (
            <div className="py-6 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center">
                <Users size={24} className="text-primary" />
              </div>
              <div>
                <p className="font-medium text-text-primary">尚未加入任何家庭</p>
                <p className="text-text-secondary mt-1 text-sm">
                  添加账户需先创建或加入一个家庭。请前往「家庭协同」页创建。
                </p>
              </div>
              <Button
                onClick={() => {
                  onOpenChange(false);
                  navigate('/family');
                }}
              >
                去「家庭协同」创建家庭
              </Button>
            </div>
          )
        ) : (
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
          {/* 账户类型选择 */}
          <div className="space-y-2">
            <Label>账户类型</Label>
            <div className="grid grid-cols-3 gap-2">
              {ACCOUNT_TYPE_ORDER.map((t) => {
                const meta = ACCOUNT_TYPE_META[t];
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
                      active
                        ? 'border-primary bg-primary-50 text-primary-600'
                        : 'border-border bg-surface text-text-secondary hover:border-primary/30',
                    )}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: meta.color }}
                    />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 账户名称 */}
          <div className="space-y-1.5">
            <Label htmlFor="acc-name">账户名称</Label>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：招行储蓄卡 / 微信钱包"
            />
          </div>

          {/* 余额 / 欠款 */}
          <div className="space-y-1.5">
            <Label htmlFor="acc-balance">
              {type === AccountType.CREDIT ? '当前欠款（元）' : '余额（元）'}
            </Label>
            <Input
              id="acc-balance"
              type="number"
              step="0.01"
              min="0"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* 机构（储蓄卡/信用卡） */}
          {(type === AccountType.DEBIT || type === AccountType.CREDIT) && (
            <div className="space-y-1.5">
              <Label htmlFor="acc-inst">发卡/开户机构</Label>
              <Input
                id="acc-inst"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="如：招商银行"
              />
            </div>
          )}

          {/* 卡号后4位（储蓄卡/信用卡） */}
          {(type === AccountType.DEBIT || type === AccountType.CREDIT) && (
            <div className="space-y-1.5">
              <Label htmlFor="acc-last4">卡号后4位</Label>
              <Input
                id="acc-last4"
                value={lastFourDigits}
                onChange={(e) => setLastFourDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="4位数字"
                maxLength={4}
              />
            </div>
          )}

          {/* 信用卡专属字段 */}
          {type === AccountType.CREDIT && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="acc-limit">授信额度（元）</Label>
                  <Input
                    id="acc-limit"
                    type="number"
                    step="0.01"
                    min="0"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="acc-bill">账单日（1-31）</Label>
                  <Input
                    id="acc-bill"
                    type="number"
                    min="1"
                    max="31"
                    value={billingDay}
                    onChange={(e) => setBillingDay(e.target.value)}
                    placeholder="如：5"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acc-due">还款日（1-31）</Label>
                <Input
                  id="acc-due"
                  type="number"
                  min="1"
                  max="31"
                  value={paymentDueDay}
                  onChange={(e) => setPaymentDueDay(e.target.value)}
                  placeholder="如：23"
                />
              </div>

              {/* 实时预览 */}
              {previewAvailable != null && (
                <div className="rounded-lg bg-primary-50 p-3 text-sm">
                  <div className="flex justify-between text-text-secondary">
                    <span>可用额度</span>
                    <span className="font-semibold text-primary-600">
                      {formatCurrency(previewAvailable)}
                    </span>
                  </div>
                  {previewDueDays != null && (
                    <div className="flex justify-between text-text-secondary mt-1">
                      <span>距还款日</span>
                      <span className="font-medium text-text-primary">约 {previewDueDays} 天</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* 平台（投资/钱包） */}
          {(type === AccountType.INVESTMENT || type === AccountType.E_WALLET) && (
            <div className="space-y-1.5">
              <Label htmlFor="acc-platform">平台</Label>
              <Input
                id="acc-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                placeholder={type === AccountType.E_WALLET ? '如：支付宝 / 微信' : '如：天天基金'}
              />
            </div>
          )}

          {/* 用途（虚拟） */}
          {type === AccountType.VIRTUAL && (
            <div className="space-y-1.5">
              <Label htmlFor="acc-purpose">用途说明</Label>
              <Input
                id="acc-purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="如：年终奖专项 / 旅游基金"
              />
            </div>
          )}
        </div>
        )}

        <DialogFooter className="flex items-center justify-between">
          {isEdit && account ? (
            <Button
              variant="outline"
              className={cn(
                account.isActive
                  ? 'text-expense border-expense/30 hover:bg-expense/5'
                  : 'text-income border-income/30 hover:bg-income/5',
              )}
              onClick={handleToggleActive}
            >
              {account.isActive ? '停用账户' : '启用账户'}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving || !resolvedFamilyId}>
              {saving ? '保存中...' : isEdit ? '保存修改' : '创建账户'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

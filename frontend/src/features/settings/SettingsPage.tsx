import { useState } from 'react';
import {
  User,
  Shield,
  Bell,
  CreditCard,
  Database,
  LogOut,
  Camera,
  Check,
  Smartphone,
  Mail,
  Lock,
  Globe,
  Moon,
  Sun,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useToast } from '@/components/ui/toaster';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { getCurrentFamily } from '@/services/family.service';
import { clearAllTransactions } from '@/services/transaction.service';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn, formatDate } from '@/lib/utils';
import { ROUTES } from '@/lib/constants';

/**
 * 设置页面（T03完善版）
 * 包含：个人信息、安全设置、通知偏好、订阅管理、数据管理
 * 使用Tab式布局，左侧分类导航 + 右侧内容区
 */

type SettingTab = 'profile' | 'security' | 'notifications' | 'subscription' | 'data';

interface TabConfig {
  id: SettingTab;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  description: string;
}

const TAB_CONFIGS: TabConfig[] = [
  { id: 'profile', label: '个人信息', icon: User, description: '管理你的头像、昵称和联系方式' },
  { id: 'security', label: '安全设置', icon: Shield, description: '密码、两步验证和登录设备' },
  { id: 'notifications', label: '通知偏好', icon: Bell, description: '推送、邮件和提醒设置' },
  { id: 'subscription', label: '订阅管理', icon: CreditCard, description: '套餐和账单管理' },
  { id: 'data', label: '数据管理', icon: Database, description: '导入、导出和删除数据' },
];

export function SettingsPage() {
  const { user, logout, setUser } = useAuthStore();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingTab>('profile');

  // 个人信息表单状态
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // 安全设置状态
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // 通知偏好状态
  const [notifSettings, setNotifSettings] = useState({
    pushEnabled: true,
    emailEnabled: false,
    budgetAlert: true,
    largeExpenseAlert: true,
    weeklyReport: true,
    monthlyReport: true,
    familyUpdate: true,
  });

  // 主题状态
  const { theme, setTheme } = useUIStore();

  // 删除账户弹窗
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // 清除数据弹窗
  const [clearDataDialogOpen, setClearDataDialogOpen] = useState(false);

  // 保存个人信息
  const handleSaveProfile = async () => {
    if (!nickname.trim()) {
      toast({ title: '昵称不能为空', variant: 'destructive' });
      return;
    }
    setSavingProfile(true);
    try {
      // 模拟API调用
      await new Promise((resolve) => setTimeout(resolve, 800));
      if (user) {
        setUser({ ...user, nickname: nickname.trim(), phone: phone.trim() || null, email: email.trim() || null });
      }
      toast({ title: '个人信息已保存', variant: 'success' });
    } catch {
      toast({ title: '保存失败，请重试', variant: 'destructive' });
    } finally {
      setSavingProfile(false);
    }
  };

  // 修改密码
  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast({ title: '请填写所有密码字段', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: '两次输入的新密码不一致', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: '密码长度至少6位', variant: 'destructive' });
      return;
    }
    setChangingPassword(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      toast({ title: '密码修改成功', variant: 'success' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast({ title: '密码修改失败，请检查旧密码', variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  };

  // 通知开关切换
  const handleNotifToggle = (key: keyof typeof notifSettings, value: boolean) => {
    setNotifSettings((prev) => ({ ...prev, [key]: value }));
    toast({
      title: value ? '已开启' : '已关闭',
      description: key === 'pushEnabled' ? 'Web推送通知' : key === 'emailEnabled' ? '邮件通知' : '',
      variant: 'default',
    });
  };

  // 导出数据
  const handleExportData = () => {
    const data = JSON.stringify({ user, exportDate: new Date().toISOString() }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `family-finance-export-${formatDate(new Date(), 'yyyyMMdd')}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: '数据已导出', variant: 'success' });
  };

  // 退出登录
  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  // 删除账户
  const handleDeleteAccount = () => {
    if (deleteConfirmText !== '确认删除') {
      toast({ title: '请输入"确认删除"以继续', variant: 'destructive' });
      return;
    }
    logout();
    navigate(ROUTES.LOGIN);
    toast({ title: '账户已删除', description: '感谢你的使用', variant: 'default' });
  };

  // 清除所有交易数据
  const handleClearAllData = async () => {
    setClearDataDialogOpen(false);
    try {
      const family = await getCurrentFamily();
      const { deleted } = await clearAllTransactions({ familyId: family.id, confirm: true });
      toast({
        title: '所有交易数据已清除',
        description: `已删除 ${deleted} 条交易`,
        variant: 'success',
      });
    } catch (err: any) {
      toast({
        title: '清除失败',
        description: err?.message || '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  const activeConfig = TAB_CONFIGS.find((t) => t.id === activeTab)!;

  return (
    <div className="page-container">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">设置</h1>
        <p className="text-text-secondary mt-1">管理你的账户和偏好设置</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* 左侧Tab导航 */}
        <div className="md:w-56 shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {TAB_CONFIGS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-text-secondary hover:bg-primary-50 hover:text-primary',
                  )}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
            {/* 退出登录按钮 */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-expense hover:bg-expense/5 transition-colors whitespace-nowrap"
            >
              <LogOut size={16} />
              <span>退出登录</span>
            </button>
          </nav>
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 min-w-0">
          {/* Tab描述 */}
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <activeConfig.icon size={18} className="text-primary" />
              {activeConfig.label}
            </h2>
            <p className="text-sm text-text-tertiary mt-0.5">{activeConfig.description}</p>
          </div>

          {/* ==================== 个人信息 ==================== */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              {/* 头像 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">头像</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Avatar
                        src={user?.avatar || undefined}
                        fallback={user?.nickname?.charAt(0) || '?'}
                        size="lg"
                      />
                      <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center shadow-md hover:bg-primary-600 transition-colors">
                        <Camera size={14} />
                      </button>
                    </div>
                    <div>
                      <p className="text-sm text-text-secondary">点击头像上传新图片</p>
                      <p className="text-xs text-text-tertiary mt-0.5">支持 JPG、PNG，最大 2MB</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 基本信息表单 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">基本信息</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="nickname">昵称</Label>
                    <Input
                      id="nickname"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="输入昵称"
                      maxLength={20}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">手机号</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="未绑定"
                        maxLength={11}
                      />
                      <Button variant="outline" size="sm" className="shrink-0">
                        <Smartphone size={14} className="mr-1" />
                        绑定
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">邮箱</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="未绑定"
                      />
                      <Button variant="outline" size="sm" className="shrink-0">
                        <Mail size={14} className="mr-1" />
                        绑定
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-text-tertiary">
                      注册时间：{user ? formatDate(user.createdAt, 'yyyy-MM-dd') : '—'}
                    </span>
                    <Button onClick={handleSaveProfile} disabled={savingProfile}>
                      {savingProfile ? '保存中...' : '保存修改'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ==================== 安全设置 ==================== */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              {/* 修改密码 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lock size={16} className="text-primary" />
                    修改密码
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="oldPassword">当前密码</Label>
                    <Input
                      id="oldPassword"
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="输入当前密码"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newPassword">新密码</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="至少6位"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword">确认新密码</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="再次输入新密码"
                    />
                  </div>
                  <Button onClick={handleChangePassword} disabled={changingPassword}>
                    {changingPassword ? '修改中...' : '确认修改'}
                  </Button>
                </CardContent>
              </Card>

              {/* 两步验证 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield size={16} className="text-primary" />
                    两步验证
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text-primary">
                        启用两步验证
                      </p>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        登录时需要额外输入验证码，提升账户安全性
                      </p>
                    </div>
                    <Switch
                      checked={twoFactorEnabled}
                      onCheckedChange={(checked) => {
                        setTwoFactorEnabled(checked);
                        toast({
                          title: checked ? '两步验证已开启' : '两步验证已关闭',
                          variant: checked ? 'success' : 'default',
                        });
                      }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 登录设备 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Smartphone size={16} className="text-primary" />
                    登录设备管理
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                        <Globe size={18} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">Chrome · Windows</p>
                        <p className="text-xs text-text-tertiary">当前设备 · 最后活跃：刚刚</p>
                      </div>
                    </div>
                    <Badge variant="success">在线</Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
                        <Smartphone size={18} className="text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">Safari · iPhone</p>
                        <p className="text-xs text-text-tertiary">最后活跃：3天前</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      退出
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ==================== 通知偏好 ==================== */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">通知渠道</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <NotifToggle
                    label="Web推送通知"
                    description="在浏览器中接收实时推送"
                    checked={notifSettings.pushEnabled}
                    onChange={(v) => handleNotifToggle('pushEnabled', v)}
                  />
                  <Separator />
                  <NotifToggle
                    label="邮件通知"
                    description="重要通知通过邮件发送"
                    checked={notifSettings.emailEnabled}
                    onChange={(v) => handleNotifToggle('emailEnabled', v)}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">提醒类型</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <NotifToggle
                    label="预算超支提醒"
                    description="当支出接近或超过预算时通知"
                    checked={notifSettings.budgetAlert}
                    onChange={(v) => handleNotifToggle('budgetAlert', v)}
                  />
                  <Separator />
                  <NotifToggle
                    label="大额支出提醒"
                    description="单笔支出超过1000元时通知"
                    checked={notifSettings.largeExpenseAlert}
                    onChange={(v) => handleNotifToggle('largeExpenseAlert', v)}
                  />
                  <Separator />
                  <NotifToggle
                    label="家庭记账动态"
                    description="家庭成员新增交易时通知"
                    checked={notifSettings.familyUpdate}
                    onChange={(v) => handleNotifToggle('familyUpdate', v)}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">报告推送</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <NotifToggle
                    label="周报推送"
                    description="每周一推送上周财务摘要"
                    checked={notifSettings.weeklyReport}
                    onChange={(v) => handleNotifToggle('weeklyReport', v)}
                  />
                  <Separator />
                  <NotifToggle
                    label="月报推送"
                    description="每月1日推送上月财务分析报告"
                    checked={notifSettings.monthlyReport}
                    onChange={(v) => handleNotifToggle('monthlyReport', v)}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* ==================== 订阅管理 ==================== */}
          {activeTab === 'subscription' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">当前套餐</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-primary-50 to-primary-100/50 border border-primary/20">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-bold text-primary">免费版</span>
                        <Badge variant="success">使用中</Badge>
                      </div>
                      <p className="text-sm text-text-secondary">永久免费 · 基础功能</p>
                    </div>
                    <Button variant="outline" size="sm">
                      升级专业版
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="text-center p-3 rounded-lg bg-surface">
                      <p className="text-2xl font-bold text-text-primary">∞</p>
                      <p className="text-xs text-text-tertiary mt-1">交易记录</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-surface">
                      <p className="text-2xl font-bold text-text-primary">5</p>
                      <p className="text-xs text-text-tertiary mt-1">家庭成员</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-surface">
                      <p className="text-2xl font-bold text-text-primary">3</p>
                      <p className="text-xs text-text-tertiary mt-1">AI洞察/月</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">专业版特权</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      '无限AI财务洞察和智能建议',
                      '无限家庭成员和共享账本',
                      '高级预算分析和预测',
                      '自定义分类和标签',
                      '优先客服支持',
                      '无广告体验',
                    ].map((feature) => (
                      <div key={feature} className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Check size={12} className="text-primary" />
                        </div>
                        <span className="text-sm text-text-secondary">{feature}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-4 rounded-lg bg-primary-50/50 border border-primary/10">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-primary">¥19.9</span>
                      <span className="text-sm text-text-tertiary">/月</span>
                    </div>
                    <p className="text-xs text-text-tertiary mt-1">年付立减2个月，仅 ¥199/年</p>
                    <Button className="w-full mt-3">
                      立即升级
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ==================== 数据管理 ==================== */}
          {activeTab === 'data' && (
            <div className="space-y-4">
              {/* 主题切换 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {theme === 'light' ? <Sun size={16} className="text-primary" /> : <Moon size={16} className="text-primary" />}
                    外观主题
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setTheme('light')}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-colors',
                        theme === 'light'
                          ? 'border-primary bg-primary-50 text-primary'
                          : 'border-border text-text-secondary hover:border-primary/30',
                      )}
                    >
                      <Sun size={16} />
                      <span className="text-sm font-medium">浅色模式</span>
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-colors',
                        theme === 'dark'
                          ? 'border-primary bg-primary-50 text-primary'
                          : 'border-border text-text-secondary hover:border-primary/30',
                      )}
                    >
                      <Moon size={16} />
                      <span className="text-sm font-medium">深色模式</span>
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* 数据导出 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Download size={16} className="text-primary" />
                    导出数据
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-text-secondary mb-3">
                    将你的所有交易记录、预算和分类数据导出为JSON文件
                  </p>
                  <Button variant="outline" onClick={handleExportData}>
                    <Download size={14} className="mr-1.5" />
                    导出全部数据
                  </Button>
                </CardContent>
              </Card>

              {/* 数据导入 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Upload size={16} className="text-primary" />
                    导入数据
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-text-secondary mb-3">
                    从其他记账应用导入数据，支持CSV、OFX格式
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => navigate(ROUTES.IMPORT)}
                  >
                    <Upload size={14} className="mr-1.5" />
                    前往导入页面
                  </Button>
                </CardContent>
              </Card>

              {/* 危险区域 */}
              <Card className="border-expense/20">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-expense">
                    <AlertTriangle size={16} />
                    危险操作
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text-primary">清除所有交易数据</p>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        删除所有交易记录，保留账户和设置
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="text-expense border-expense/30 hover:bg-expense/5"
                      onClick={() => setClearDataDialogOpen(true)}
                    >
                      <Trash2 size={14} className="mr-1" />
                      清除
                    </Button>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-expense">删除账户</p>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        永久删除账户和所有数据，此操作不可逆
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 size={14} className="mr-1" />
                      删除账户
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* 清除交易数据确认弹窗 */}
      <Dialog open={clearDataDialogOpen} onOpenChange={setClearDataDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-expense">
              <AlertTriangle size={18} />
              确认清除数据
            </DialogTitle>
            <DialogDescription>
              此操作将删除所有交易记录，但保留账户、分类、预算等设置。此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClearDataDialogOpen(false)}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={handleClearAllData}>
              确认清除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除账户确认弹窗 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-expense">
              <AlertTriangle size={18} />
              确认删除账户
            </DialogTitle>
            <DialogDescription>
              此操作将永久删除你的账户和所有数据，包括交易记录、预算、分类等，且不可恢复。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-text-secondary">
              请输入 <span className="font-bold text-expense">确认删除</span> 以继续：
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="确认删除"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmText('');
              }}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={handleDeleteAccount}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== 辅助组件 ====================

/** 通知开关行 */
function NotifToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <p className="text-xs text-text-tertiary mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

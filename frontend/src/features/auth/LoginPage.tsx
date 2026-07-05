import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Wallet,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Users,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { login as loginApi } from '@/services/auth.service';
import { APP_NAME } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * 登录页面
 * 左侧品牌区（翡翠绿渐变 + Logo + Slogan + 特性列表）
 * 右侧手机号 + 密码登录表单
 */
export function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const isEmail = account.includes('@');
      const loginData = isEmail
        ? { email: account, password }
        : { phone: account, password };

      const result = await loginApi(loginData);
      setAuth(result);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 品牌区特性列表
  const features = [
    { icon: Sparkles, title: 'AI智能记账', desc: '自然语言输入，秒级分类' },
    { icon: Users, title: '家庭协同', desc: '多人共享账本，实时同步' },
    { icon: TrendingUp, title: '财务洞察', desc: '月度AI报告，智能建议' },
    { icon: ShieldCheck, title: '安全可靠', desc: '银行级加密，数据无忧' },
  ];

  return (
    <div className="flex min-h-screen">
      {/* 左侧品牌区 */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 text-white relative overflow-hidden">
        {/* 装饰圆 */
        /* eslint-disable-next-line */}
        <div className="absolute top-20 right-20 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-20 left-20 w-48 h-48 rounded-full bg-white/5 blur-3xl" />

        {/* Logo + Slogan */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Wallet size={28} className="text-white" />
            </div>
            <span className="text-2xl font-bold">{APP_NAME}</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-3">
            AI驱动的<br />家庭记账与财务规划
          </h1>
          <p className="text-white/80 text-lg">
            让每一笔收支都清晰可见，让家庭财务更简单
          </p>
        </div>

        {/* 特性列表 */}
        <div className="relative z-10 grid grid-cols-2 gap-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="p-4 rounded-xl bg-white/10 backdrop-blur border border-white/10"
              >
                <Icon size={24} className="text-white mb-2" />
                <h3 className="text-sm font-semibold mb-1">{feature.title}</h3>
                <p className="text-xs text-white/70">{feature.desc}</p>
              </div>
            );
          })}
        </div>

        {/* 底部版权 */}
        <p className="relative z-10 text-sm text-white/60">
          © 2026 {APP_NAME} · 让家庭财务更美好
        </p>
      </div>

      {/* 右侧登录表单 */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          {/* 移动端Logo */}
          <div className="flex lg:hidden flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-3">
              <Wallet size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-text-primary">{APP_NAME}</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-text-primary mb-1">欢迎回来</h2>
            <p className="text-text-secondary">登录你的账户继续使用</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="px-3 py-2 rounded-lg bg-expense/10 text-expense text-sm">
                {error}
              </div>
            )}

            {/* 账号输入 */}
            <div className="space-y-2">
              <Label htmlFor="account">手机号 / 邮箱</Label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <Input
                  id="account"
                  type="text"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder="请输入手机号或邮箱"
                  className="pl-9"
                  required
                />
              </div>
            </div>

            {/* 密码输入 */}
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="pl-9 pr-9"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* 登录按钮 */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11"
            >
              {loading ? '登录中...' : '登录'}
            </Button>

            {/* 注册链接 */}
            <p className="text-center text-sm text-text-secondary">
              还没有账号？{' '}
              <Link to="/register" className="text-primary font-medium hover:underline">
                立即注册
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

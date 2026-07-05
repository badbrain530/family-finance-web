import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Tags,
  Check,
  ChevronLeft,
  ChevronRight,
  Home,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

/**
 * Onboarding 引导页面
 * 3步引导流程：创建家庭 → 邀请成员 → 初始化分类
 */
export function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [step, setStep] = useState(0);
  const [familyName, setFamilyName] = useState('');
  const [mode, setMode] = useState<'family' | 'personal'>('family');
  const [inviteCode, setInviteCode] = useState('');
  const [loading] = useState(false);

  const steps = [
    { title: '创建家庭', icon: Home, desc: '设置你的家庭名称和模式' },
    { title: '邀请成员', icon: UserPlus, desc: '邀请家人一起记账' },
    { title: '初始化分类', icon: Tags, desc: '选择适合你的分类体系' },
  ];

  const handleNext = () => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      // 完成引导，跳转仪表盘
      navigate('/dashboard');
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSkip = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* 顶部进度条 */}
      <div className="border-b border-border bg-surface">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">
            欢迎使用，{user?.nickname || '新用户'}
          </span>
          <button
            onClick={handleSkip}
            className="text-sm text-text-secondary hover:text-primary transition-colors"
          >
            跳过引导
          </button>
        </div>
        <div className="max-w-2xl mx-auto px-6 pb-4">
          <div className="flex items-center gap-2">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              return (
                <div key={idx} className="flex items-center flex-1">
                  <div
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      idx === step
                        ? 'bg-primary text-white'
                        : idx < step
                          ? 'bg-primary-50 text-primary-600'
                          : 'bg-primary-50/30 text-text-tertiary',
                    )}
                  >
                    {idx < step ? (
                      <Check size={16} />
                    ) : (
                      <Icon size={16} />
                    )}
                    <span className="hidden sm:inline">{s.title}</span>
                    <span className="sm:hidden">{idx + 1}</span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-1 rounded-full transition-colors',
                        idx < step ? 'bg-primary' : 'bg-border',
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 步骤内容 */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {/* Step 1: 创建家庭 */}
          {step === 0 && (
            <Card className="p-8 animate-slide-up">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center">
                  <Home size={24} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text-primary">创建家庭</h2>
                  <p className="text-sm text-text-secondary">设置你的家庭名称和使用模式</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="familyName">家庭名称</Label>
                  <Input
                    id="familyName"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="例如：张家的小日子"
                  />
                </div>

                <div className="space-y-2">
                  <Label>使用模式</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setMode('family')}
                      className={cn(
                        'p-4 rounded-xl border-2 text-left transition-all',
                        mode === 'family'
                          ? 'border-primary bg-primary-50'
                          : 'border-border hover:border-primary-200',
                      )}
                    >
                      <Users size={20} className="text-primary mb-2" />
                      <h3 className="text-sm font-semibold text-text-primary">家庭模式</h3>
                      <p className="text-xs text-text-secondary mt-1">多人共享，协同记账</p>
                    </button>
                    <button
                      onClick={() => setMode('personal')}
                      className={cn(
                        'p-4 rounded-xl border-2 text-left transition-all',
                        mode === 'personal'
                          ? 'border-primary bg-primary-50'
                          : 'border-border hover:border-primary-200',
                      )}
                    >
                      <Home size={20} className="text-primary mb-2" />
                      <h3 className="text-sm font-semibold text-text-primary">个人模式</h3>
                      <p className="text-xs text-text-secondary mt-1">独自使用，简洁高效</p>
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Step 2: 邀请成员 */}
          {step === 1 && (
            <Card className="p-8 animate-slide-up">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center">
                  <UserPlus size={24} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text-primary">邀请家庭成员</h2>
                  <p className="text-sm text-text-secondary">分享邀请码让家人加入</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-6 rounded-xl bg-gradient-to-br from-primary-50 to-primary-100/50 text-center">
                  <p className="text-sm text-text-secondary mb-3">你的家庭邀请码</p>
                  <div className="text-4xl font-bold text-primary tracking-widest mb-2">
                    {inviteCode || '8KQ2X9'}
                  </div>
                  <p className="text-xs text-text-tertiary">
                    邀请码7天内有效，家人注册后输入即可加入
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setInviteCode(inviteCode || '8KQ2X9');
                    }}
                  >
                    复制邀请码
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                  >
                    分享链接
                  </Button>
                </div>

                <div className="p-4 rounded-lg bg-primary-50/50 border border-primary-100">
                  <p className="text-sm text-text-secondary">
                    💡 你也可以稍后在「家庭协同」页面邀请成员
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Step 3: 初始化分类 */}
          {step === 2 && (
            <Card className="p-8 animate-slide-up">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center">
                  <Tags size={24} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text-primary">初始化分类</h2>
                  <p className="text-sm text-text-secondary">已为你预设国标8大类支出分类</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { name: '食品烟酒', icon: '🍱', color: '#FF6B6B' },
                    { name: '衣着', icon: '👕', color: '#4ECDC4' },
                    { name: '居住', icon: '🏠', color: '#45B7D1' },
                    { name: '生活用品', icon: '🛒', color: '#96CEB4' },
                    { name: '交通通信', icon: '🚗', color: '#FFEAA7' },
                    { name: '教育文化', icon: '📚', color: '#DDA0DD' },
                    { name: '医疗保健', icon: '💊', color: '#FF8C94' },
                    { name: '其他', icon: '📋', color: '#A8A8A8' },
                  ].map((cat) => (
                    <div
                      key={cat.name}
                      className="flex items-center gap-2 p-3 rounded-lg border border-border hover:border-primary-200 transition-colors"
                    >
                      <span className="text-xl">{cat.icon}</span>
                      <span className="text-sm font-medium text-text-primary">{cat.name}</span>
                      <Check size={14} className="ml-auto text-primary" />
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-lg bg-primary-50/50 border border-primary-100">
                  <p className="text-sm text-text-secondary">
                    💡 你可以随时在设置中添加、修改或删除分类
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* 导航按钮 */}
          <div className="flex items-center justify-between mt-6">
            <Button
              variant="ghost"
              onClick={handlePrev}
              disabled={step === 0}
              className="text-text-secondary"
            >
              <ChevronLeft size={16} />
              上一步
            </Button>

            <Button onClick={handleNext} disabled={loading}>
              {step === 2 ? '完成设置' : '下一步'}
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

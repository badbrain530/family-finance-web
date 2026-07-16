import { useEffect, useState } from 'react';
import { KeyRound, Plus, Copy, Check, Trash2, ShieldAlert, Bot } from 'lucide-react';
import { useApiKeyStore } from './apikey.store';
import { useToast } from '@/components/ui/toaster';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
  DialogDescription,
} from '@/components/ui/dialog';
import { ApiKeyGuide } from './ApiKeyGuide';
import type { ApiKeyScope } from './types';
import { API_BASE_URL } from '@/lib/constants';
import { cn, formatDate } from '@/lib/utils';

/**
 * 智能体接入页面（P0 第三期）
 * - 列出 / 创建 / 吊销 API Key（明文仅创建时展示一次）；
 * - 内嵌 QClaw 接入指南。
 */
export function ApiKeyPage() {
  const { keys, loading, creating, fetchKeys, createKey, revokeKey } = useApiKeyStore();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [scope, setScope] = useState<ApiKeyScope>('READWRITE');
  const [name, setName] = useState('');
  const [plainKey, setPlainKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchKeys().catch(() => undefined);
  }, [fetchKeys]);

  // MCP 端点 = API 基址去掉 /api 后缀 + /mcp
  // 开发环境 → http://localhost:3001/mcp；生产 → https://family-finance.cloud/mcp
  const mcpBase = API_BASE_URL.replace(/\/api\/?$/, '');
  const endpoint = `${mcpBase}/mcp`;

  const handleCreate = async () => {
    try {
      const res = await createKey({ scope, name: name.trim() || undefined });
      setPlainKey(res.plainKey);
      setCreateOpen(false);
      setName('');
      toast({ title: '密钥已创建', variant: 'success' });
    } catch (err: any) {
      toast({
        title: '创建失败',
        description: err?.message || '请重试',
        variant: 'destructive',
      });
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeKey(id);
      toast({ title: '密钥已吊销', variant: 'success' });
    } catch (err: any) {
      toast({
        title: '吊销失败',
        description: err?.message || '请重试',
        variant: 'destructive',
      });
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="page-container">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Bot size={22} className="text-primary" />
          智能体接入
        </h1>
        <p className="text-text-secondary mt-1">
          生成 API Key 并将家庭财务应用接入 QClaw（龙虾）智能体，由其调用 MCP 工具记账与查询。
        </p>
      </div>

      <div className="space-y-6">
        {/* 密钥列表 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound size={16} className="text-primary" />
              我的 API Key
            </CardTitle>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus size={14} className="mr-1" />
              创建新密钥
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-text-tertiary">加载中...</p>
            ) : keys.length === 0 ? (
              <p className="text-sm text-text-tertiary">
                尚未创建任何密钥，点击右上角「创建新密钥」开始。
              </p>
            ) : (
              <div className="space-y-3">
                {keys.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary truncate">
                          {k.name || '未命名密钥'}
                        </span>
                        <Badge variant={k.scope === 'READONLY' ? 'secondary' : 'default'}>
                          {k.scope === 'READONLY' ? '只读' : '读写'}
                        </Badge>
                        {k.revokedAt && <Badge variant="destructive">已吊销</Badge>}
                      </div>
                      <p className="text-xs text-text-tertiary mt-1 font-mono truncate">
                        {k.maskedKey}
                      </p>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        创建 {formatDate(k.createdAt, 'yyyy-MM-dd')}
                        {k.lastUsedAt
                          ? ` · 上次使用 ${formatDate(k.lastUsedAt, 'yyyy-MM-dd HH:mm')}`
                          : ''}
                      </p>
                    </div>
                    {!k.revokedAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-expense border-expense/30 hover:bg-expense/5 shrink-0 ml-3"
                        onClick={() => handleRevoke(k.id)}
                      >
                        <Trash2 size={14} className="mr-1" />
                        吊销
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 接入指南 */}
        <ApiKeyGuide endpoint={endpoint} latestPlainKey={plainKey} />
      </div>

      {/* 创建对话框 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus size={18} />
              创建新密钥
            </DialogTitle>
            <DialogDescription>密钥明文仅在创建时显示一次，请妥善保存。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="key-name">备注名称（可选）</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：我的龙虾-只读"
                maxLength={40}
              />
            </div>
            <div className="space-y-1.5">
              <Label>作用域</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope('READWRITE')}
                  className={cn(
                    'flex flex-col items-start gap-1 p-3 rounded-lg border-2 text-left transition-colors',
                    scope === 'READWRITE'
                      ? 'border-primary bg-primary-50'
                      : 'border-border hover:border-primary/30',
                  )}
                >
                  <span className="text-sm font-medium text-text-primary">读写</span>
                  <span className="text-xs text-text-tertiary">可使用全部工具（含记账）</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScope('READONLY')}
                  className={cn(
                    'flex flex-col items-start gap-1 p-3 rounded-lg border-2 text-left transition-colors',
                    scope === 'READONLY'
                      ? 'border-primary bg-primary-50'
                      : 'border-border hover:border-primary/30',
                  )}
                >
                  <span className="text-sm font-medium text-text-primary">只读</span>
                  <span className="text-xs text-text-tertiary">仅查询 / 汇总</span>
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              取消
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 明文密钥展示对话框（仅一次） */}
      <Dialog open={!!plainKey} onOpenChange={(o) => { if (!o) setPlainKey(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-expense">
              <ShieldAlert size={18} />
              请立即复制保存你的密钥
            </DialogTitle>
            <DialogDescription>
              这是密钥明文的唯一展示机会，关闭后将无法再次查看。
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 rounded-lg bg-background border border-border flex items-center justify-between gap-2">
            <code className="text-sm text-primary break-all">{plainKey}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => plainKey && handleCopy(plainKey)}
            >
              {copied ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
              {copied ? '已复制' : '复制'}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setPlainKey(null)}>我已保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { KeyRound, ShieldCheck } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface ApiKeyGuideProps {
  /** MCP 端点（HTTPS），如 https://family-finance.cloud/mcp */
  endpoint: string;
  /** 刚创建的明文密钥，用于填充示例配置（可选） */
  latestPlainKey?: string | null;
}

/**
 * QClaw（龙虾）智能体接入指南
 * 展示 MCP 端点与 openclaw.json 配置样例，指导用户把密钥填入 QClaw。
 */
export function ApiKeyGuide({ endpoint, latestPlainKey }: ApiKeyGuideProps) {
  const configJson = JSON.stringify(
    {
      mcpServers: {
        'family-finance': {
          url: endpoint,
          headers: {
            'X-API-Key': latestPlainKey || 'ak_live_xxxxxxxxxxxxxxxx',
          },
        },
      },
    },
    null,
    2,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound size={16} className="text-primary" />
          如何接入 QClaw（龙虾）智能体
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-text-secondary">
        <ol className="list-decimal list-inside space-y-2">
          <li>在「我的 API Key」中创建一个密钥（明文仅在创建时显示一次，请先复制保存）。</li>
          <li>将密钥填入 QClaw 的 MCP 配置（openclaw.json）的 <code>X-API-Key</code> 字段。</li>
          <li>服务端地址填写下方 MCP 端点，QClaw 即可调用本应用提供的三个工具。</li>
        </ol>

        <div className="p-3 rounded-lg bg-surface border border-border">
          <p className="text-xs font-medium text-text-tertiary mb-1">MCP 端点（HTTPS）</p>
          <code className="text-sm text-primary break-all">{endpoint}</code>
        </div>

        <div>
          <p className="text-xs font-medium text-text-tertiary mb-1">openclaw.json 示例</p>
          <pre className="p-3 rounded-lg bg-background border border-border overflow-x-auto text-xs leading-relaxed">
            <code>{configJson}</code>
          </pre>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary-50 border border-primary/10">
          <ShieldCheck size={16} className="text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-primary">
            密钥为永久有效，可按作用域（只读 / 读写）发放；若泄露请立即吊销，吊销后 QClaw 配置将立即失效。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

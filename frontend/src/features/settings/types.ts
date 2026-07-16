/**
 * 智能体接入（QClaw / MCP）相关类型定义
 * 与后端 ApiKeyModule 的响应结构对齐。
 */

/** API Key 作用域 */
export type ApiKeyScope = 'READONLY' | 'READWRITE';

/** 密钥脱敏视图（列表返回，明文永不外泄） */
export interface ApiKey {
  id: string;
  name: string | null;
  scope: ApiKeyScope;
  /** 形如 ak_live_8f3c•••••••• 的展示串 */
  maskedKey: string;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

/** 创建密钥请求 */
export interface CreateApiKeyRequest {
  scope: ApiKeyScope;
  name?: string;
}

/** 创建密钥响应（plainKey 仅返回一次） */
export interface CreateApiKeyResponse {
  id: string;
  name: string | null;
  scope: ApiKeyScope;
  /** 明文 Key，仅此一次返回 */
  plainKey: string;
  maskedKey: string;
  createdAt: string;
}

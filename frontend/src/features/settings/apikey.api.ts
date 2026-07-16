import { get, post, del } from '@/services/api';
import type {
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
} from './types';

/**
 * 智能体接入 API 服务
 * 端点经全局 /api 前缀后为 /api/api-keys，受 JWT 守卫保护。
 */

/** 列出当前用户的全部密钥 */
export function listApiKeys(): Promise<ApiKey[]> {
  return get<ApiKey[]>('/api-keys');
}

/** 生成新密钥（plainKey 仅返回一次） */
export function createApiKey(data: CreateApiKeyRequest): Promise<CreateApiKeyResponse> {
  return post<CreateApiKeyResponse>('/api-keys', data);
}

/** 吊销指定密钥（硬吊销） */
export function revokeApiKey(id: string): Promise<{ success: boolean }> {
  return del(`/api-keys/${id}`);
}

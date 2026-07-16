import { create } from 'zustand';
import { listApiKeys, createApiKey, revokeApiKey } from './apikey.api';
import type {
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
} from './types';

/**
 * 智能体接入状态管理（Zustand）
 * 管理密钥列表的加载、创建与吊销；不持久化到本地（密钥来自服务端）。
 */

/** 将创建响应映射为列表项（脱敏视图，不含明文） */
function toApiKey(res: CreateApiKeyResponse): ApiKey {
  return {
    id: res.id,
    name: res.name,
    scope: res.scope,
    maskedKey: res.maskedKey,
    createdAt: res.createdAt,
    revokedAt: null,
    lastUsedAt: null,
  };
}

interface ApiKeyState {
  keys: ApiKey[];
  loading: boolean;
  creating: boolean;
  error: string | null;

  fetchKeys: () => Promise<void>;
  createKey: (data: CreateApiKeyRequest) => Promise<CreateApiKeyResponse>;
  revokeKey: (id: string) => Promise<void>;
  reset: () => void;
}

export const useApiKeyStore = create<ApiKeyState>((set) => ({
  keys: [],
  loading: false,
  creating: false,
  error: null,

  fetchKeys: async () => {
    set({ loading: true, error: null });
    try {
      const keys = await listApiKeys();
      set({ keys, loading: false });
    } catch (err: any) {
      set({ loading: false, error: err?.message || '加载失败' });
    }
  },

  createKey: async (data) => {
    set({ creating: true, error: null });
    try {
      const res = await createApiKey(data);
      set((s) => ({ creating: false, keys: [toApiKey(res), ...s.keys] }));
      return res;
    } catch (err: any) {
      set({ creating: false, error: err?.message || '创建失败' });
      throw err;
    }
  },

  revokeKey: async (id) => {
    try {
      await revokeApiKey(id);
      set((s) => ({
        keys: s.keys.map((k) =>
          k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k,
        ),
      }));
    } catch (err: any) {
      set({ error: err?.message || '吊销失败' });
      throw err;
    }
  },

  reset: () => set({ keys: [], loading: false, creating: false, error: null }),
}));

import axios, { type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';
import { API_BASE_URL, ERROR_CODES } from '@/lib/constants';
import type { ApiResponse, ApiErrorResponse } from '@/types/api';

/**
 * Axios实例 + 请求/响应拦截器
 * 统一处理：Token注入、响应格式转换、401自动刷新Token
 */

// 创建Axios实例
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // 允许携带Cookie（Refresh Token）
});

// ==================== 请求拦截器 ====================
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ==================== 响应拦截器 ====================
api.interceptors.response.use(
  (response) => {
    // 统一响应格式：{ code, data, message }
    const apiResponse = response.data as ApiResponse;
    if (apiResponse.code === ERROR_CODES.SUCCESS) {
      return apiResponse.data;
    }
    // 业务错误
    const error = new Error(apiResponse.message || '请求失败') as Error & { code?: number; errors?: any[] };
    error.code = apiResponse.code;
    error.errors = (apiResponse as ApiErrorResponse).errors;
    return Promise.reject(error);
  },
  async (error) => {
    // HTTP错误处理
    if (error.response) {
      const { status, data } = error.response;
      const apiError = data as ApiErrorResponse;

      // 401未授权 - 尝试刷新Token
      if (status === 401) {
        const { refreshToken, setTokens, logout } = useAuthStore.getState();
        if (refreshToken && !error.config._retry) {
          error.config._retry = true;
          try {
            const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
            const { accessToken: newAccessToken, refreshToken: newRefreshToken } = res.data.data;
            setTokens(newAccessToken, newRefreshToken);
            error.config.headers.Authorization = `Bearer ${newAccessToken}`;
            return api(error.config);
          } catch {
            logout();
            window.location.href = '/login';
            return Promise.reject(new Error('登录已过期，请重新登录'));
          }
        } else {
          logout();
          window.location.href = '/login';
        }
      }

      const message = apiError?.message || `请求失败 (${status})`;
      const err = new Error(message) as Error & { code?: number; status?: number; errors?: any[] };
      err.code = apiError?.code;
      err.status = status;
      err.errors = apiError?.errors;
      return Promise.reject(err);
    }

    // 网络错误
    if (error.request) {
      return Promise.reject(new Error('网络连接失败，请检查网络'));
    }

    return Promise.reject(error);
  },
);

// ==================== 封装请求方法 ====================

/**
 * GET请求
 */
export async function get<T = any>(url: string, params?: Record<string, any>, config?: AxiosRequestConfig): Promise<T> {
  return api.get(url, { params, ...config });
}

/**
 * POST请求
 */
export async function post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  return api.post(url, data, config);
}

/**
 * PUT请求
 */
export async function put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  return api.put(url, data, config);
}

/**
 * DELETE请求
 */
export async function del<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return api.delete(url, config);
}

/**
 * 文件上传
 */
export async function upload<T = any>(url: string, formData: FormData, config?: AxiosRequestConfig): Promise<T> {
  return api.post(url, formData, {
    ...config,
    headers: { ...config?.headers, 'Content-Type': 'multipart/form-data' },
  });
}

export default api;

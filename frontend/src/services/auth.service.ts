import { post } from './api';
import type { AuthResponse, LoginRequest, RegisterRequest } from '@/types/user';

/**
 * 认证API服务
 */

/** 用户注册 */
export function register(data: RegisterRequest): Promise<AuthResponse> {
  return post<AuthResponse>('/auth/register', data);
}

/** 用户登录 */
export function login(data: LoginRequest): Promise<AuthResponse> {
  return post<AuthResponse>('/auth/login', data);
}

/** 刷新Token */
export function refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  return post('/auth/refresh', { refreshToken });
}

/** 登出 */
export function logout(refreshToken: string): Promise<{ success: boolean }> {
  return post('/auth/logout', { refreshToken });
}

/** 获取微信扫码二维码 */
export function getWechatQR(): Promise<{ qrUrl: string; ticket: string }> {
  return post('/auth/wechat/qr');
}

/** 微信登录回调 */
export function wechatCallback(code: string): Promise<AuthResponse> {
  return post<AuthResponse>('/auth/wechat/callback', { code });
}

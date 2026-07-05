/**
 * 用户相关类型定义
 */

/** 用户信息 */
export interface User {
  id: string;
  phone: string | null;
  email: string | null;
  wechatOpenId: string | null;
  nickname: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 登录请求 */
export interface LoginRequest {
  phone?: string;
  email?: string;
  password: string;
}

/** 注册请求 */
export interface RegisterRequest {
  phone?: string;
  email?: string;
  password: string;
  nickname: string;
}

/** 认证响应（登录/注册成功后返回） */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

/** 更新用户信息请求 */
export interface UpdateUserRequest {
  nickname?: string;
  avatar?: string;
}

/** 修改密码请求 */
export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

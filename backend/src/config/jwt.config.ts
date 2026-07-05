import { registerAs } from '@nestjs/config';

/**
 * JWT配置
 * Access Token: 15分钟有效期
 * Refresh Token: 7天有效期，HttpOnly Cookie
 */
export default registerAs('jwt', () => ({
  access: {
    secret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  },
  refresh: {
    secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
}));

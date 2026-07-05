import { registerAs } from '@nestjs/config';

/**
 * 数据库配置
 * PostgreSQL 16 + Prisma 5
 */
export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  name: process.env.DATABASE_NAME || 'family_finance',
  user: process.env.DATABASE_USER || 'family_finance',
  password: process.env.DATABASE_PASSWORD || 'family_finance_pwd',
}));

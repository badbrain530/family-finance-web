import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// 最小化的 vitest 配置：仅用于运行本回归测试，不影响生产构建。
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // 限制范围，避免误跑整个项目；覆盖各核心 feature 与 services 下的回归用例
    include: [
      'src/features/dashboard/**/*.test.{ts,tsx}',
      'src/features/categories/**/*.test.{ts,tsx}',
      'src/features/accounts/**/*.test.{ts,tsx}',
      'src/features/transactions/**/*.test.{ts,tsx}',
      'src/features/family/**/*.test.{ts,tsx}',
      'src/components/common/**/*.test.{ts,tsx}',
      'src/services/**/*.test.{ts,tsx}',
    ],
  },
});

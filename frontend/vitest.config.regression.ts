import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// 本次 bug 修复（账本 API 路径 + 弹窗内建账本 + FamilyLedgerPage 账本区块）的回归测试配置。
// 独立配置，仅覆盖本次改动相关目录，不改动既有 vitest.config.ts（其 include 刻意限定为
// dashboard / categories，避免误跑整个项目）。运行方式：
//   npx vitest run --config vitest.config.regression.ts
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
    include: [
      'src/services/**/*.test.{ts,tsx}',
      'src/features/transactions/**/*.test.{ts,tsx}',
      'src/features/family/**/*.test.{ts,tsx}',
    ],
  },
});

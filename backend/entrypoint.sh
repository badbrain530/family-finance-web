#!/bin/sh
set -e

echo "=== Family Finance Backend Starting ==="

# 等待数据库就绪
echo "[1/3] Waiting for PostgreSQL..."
until nc -z postgres 5432 2>/dev/null; do
  echo "  PostgreSQL not ready, retrying in 2s..."
  sleep 2
done
echo "  PostgreSQL is ready."

# 同步数据库结构
echo "[2/3] Syncing database schema..."
# 优先使用 migrate deploy（安全，基于迁移文件）
npx prisma migrate deploy 2>/dev/null || {
  echo "  No existing migrations found, using prisma db push..."
  # 回退方案：直接推送 schema（无 --accept-data-loss，更安全）
  npx prisma db push --skip-generate 2>&1 || {
    echo "  WARNING: Schema sync failed. On first deploy, you may need to run:"
    echo "  npx prisma db push --accept-data-loss"
    echo "  Continuing anyway..."
  }
}
echo "  Database schema synced."

# 生成 Prisma Client（确保客户端与 schema 一致）
npx prisma generate 2>/dev/null || true

# 启动应用
echo "[3/3] Starting NestJS application..."
exec dumb-init node dist/main.js

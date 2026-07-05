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

# 同步数据库结构（自动建表/更新表结构）
echo "[2/3] Running prisma db push..."
npx prisma db push --accept-data-loss 2>&1 || {
  echo "  WARNING: prisma db push failed, continuing anyway..."
}
echo "  Database schema synced."

# 启动应用
echo "[3/3] Starting NestJS application..."
exec dumb-init node dist/main.js

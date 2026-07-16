-- 智能体接入（QClaw / MCP）P0 迁移
-- 新增 ApiKeyScope 枚举 + api_keys 表 + TransactionSource 追加 AGENT
-- 命名：20260716000000_add_apikey_and_agent_source

-- ==================== 新增枚举 ====================
CREATE TYPE "ApiKeyScope" AS ENUM ('READONLY', 'READWRITE');

-- ==================== api_keys 表 ====================
CREATE TABLE "api_keys" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "family_id" TEXT NOT NULL,
  "key_hash" TEXT NOT NULL,
  "scope" "ApiKeyScope" NOT NULL DEFAULT 'READWRITE',
  "name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  "last_used_at" TIMESTAMP(3),
  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "api_keys_user_id_idx" ON "api_keys" ("user_id");
CREATE INDEX "api_keys_family_id_idx" ON "api_keys" ("family_id");

ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_family_id_fkey"
  FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ==================== TransactionSource 追加 AGENT ====================
-- 注意：PostgreSQL 12+ 允许在事务内执行 ALTER TYPE ... ADD VALUE；
-- 若使用更早版本，请在该迁移事务之外单独执行此句。
ALTER TYPE "TransactionSource" ADD VALUE 'AGENT';

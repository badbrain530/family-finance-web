-- 二期 P0 批次 Schema 迁移
-- 新增 4 枚举 + Transaction 8 列 + RecurringRule / Loan / LoanSchedule 三表
-- 命名：20260712000000_phase2_schema

-- ==================== 新增枚举 ====================
CREATE TYPE "Frequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');
CREATE TYPE "LoanMethod" AS ENUM ('EQUAL_INSTALLMENT', 'EQUAL_PRINCIPAL');
CREATE TYPE "RefundStatus" AS ENUM ('NONE', 'PARTIAL', 'FULL');
CREATE TYPE "ReimburseStatus" AS ENUM ('NONE', 'PENDING', 'REIMBURSED');

-- ==================== Transaction 扩展列 ====================
ALTER TABLE "transactions" ADD COLUMN "installment_group_id" TEXT;
ALTER TABLE "transactions" ADD COLUMN "installment_seq" INTEGER;
ALTER TABLE "transactions" ADD COLUMN "installment_total" INTEGER;
ALTER TABLE "transactions" ADD COLUMN "refund_of_id" TEXT;
ALTER TABLE "transactions" ADD COLUMN "refunded_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE "transactions" ADD COLUMN "refund_status" "RefundStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "transactions" ADD COLUMN "reimbursement_of_id" TEXT;
ALTER TABLE "transactions" ADD COLUMN "reimbursement_status" "ReimburseStatus" NOT NULL DEFAULT 'NONE';

CREATE INDEX "transactions_installment_group_id_idx" ON "transactions" ("installment_group_id");
CREATE INDEX "transactions_refund_of_id_idx" ON "transactions" ("refund_of_id");
CREATE INDEX "transactions_reimbursement_of_id_idx" ON "transactions" ("reimbursement_of_id");

-- ==================== RecurringRule 表 ====================
CREATE TABLE "recurring_rules" (
  "id" TEXT NOT NULL,
  "family_id" TEXT NOT NULL,
  "ledger_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "category_id" TEXT,
  "account_id" TEXT,
  "type" "TransactionType" NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "merchant" TEXT,
  "note" TEXT,
  "frequency" "Frequency" NOT NULL,
  "interval" INTEGER NOT NULL DEFAULT 1,
  "weekday" INTEGER,
  "month_day" INTEGER,
  "start_date" TIMESTAMP(3) NOT NULL,
  "end_date" TIMESTAMP(3),
  "next_run_at" TIMESTAMP(3) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "recurring_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recurring_rules_family_id_idx" ON "recurring_rules" ("family_id");
CREATE INDEX "recurring_rules_next_run_at_idx" ON "recurring_rules" ("next_run_at");

ALTER TABLE "recurring_rules"
  ADD CONSTRAINT "recurring_rules_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_rules"
  ADD CONSTRAINT "recurring_rules_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledgers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_rules"
  ADD CONSTRAINT "recurring_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recurring_rules"
  ADD CONSTRAINT "recurring_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ==================== Loan 表 ====================
CREATE TABLE "loans" (
  "id" TEXT NOT NULL,
  "family_id" TEXT NOT NULL,
  "ledger_id" TEXT NOT NULL,
  "account_id" TEXT,
  "name" TEXT NOT NULL,
  "principal" DECIMAL(14, 2) NOT NULL,
  "annual_rate" DECIMAL(6, 4) NOT NULL,
  "term_months" INTEGER NOT NULL,
  "method" "LoanMethod" NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "loans_family_id_idx" ON "loans" ("family_id");

ALTER TABLE "loans"
  ADD CONSTRAINT "loans_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loans"
  ADD CONSTRAINT "loans_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledgers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==================== LoanSchedule 表 ====================
CREATE TABLE "loan_schedules" (
  "id" TEXT NOT NULL,
  "loan_id" TEXT NOT NULL,
  "seq" INTEGER NOT NULL,
  "due_date" TIMESTAMP(3) NOT NULL,
  "payment" DECIMAL(12, 2) NOT NULL,
  "principal_part" DECIMAL(12, 2) NOT NULL,
  "interest_part" DECIMAL(12, 2) NOT NULL,
  "remaining_principal" DECIMAL(14, 2) NOT NULL,
  "generated_tx_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',

  CONSTRAINT "loan_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "loan_schedules_loan_id_idx" ON "loan_schedules" ("loan_id");

ALTER TABLE "loan_schedules"
  ADD CONSTRAINT "loan_schedules_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

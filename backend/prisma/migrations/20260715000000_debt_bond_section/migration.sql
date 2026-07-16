-- 债务/债券板块迁移（T01）
-- 新增模型：bonds / bond_schedules / amortization_items / amortization_schedules / advance_receivables
-- 扩展列：transactions.advance_of_id / transactions.amortization_item_id / loan_schedules.generated_interest_tx_id
-- 说明：generated_tx_id / generated_interest_tx_id / advance_of_id / amortization_item_id 均为普通可空字段
--       （与现有 reimbursement_of_id 同模式，仅加索引，不建外键），避免级联删除破坏历史交易。

-- ============ 枚举类型 ============
CREATE TYPE "CouponFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI', 'ANNUAL');
CREATE TYPE "AmortizationType" AS ENUM ('PREPAID', 'DEFERRED');
CREATE TYPE "PeriodType" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');
CREATE TYPE "DebtorType" AS ENUM ('PERSON', 'COMPANY', 'FAMILY');
CREATE TYPE "AdvanceStatus" AS ENUM ('PENDING', 'PARTIAL', 'RECOVERED', 'CANCELLED');

-- ============ 债券 ============
CREATE TABLE "bonds" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "ledger_id" TEXT NOT NULL,
    "account_id" TEXT,
    "name" TEXT NOT NULL,
    "face_value" DECIMAL(14,2) NOT NULL,
    "annual_rate" DECIMAL(6,4) NOT NULL,
    "term_months" INTEGER NOT NULL,
    "method" "LoanMethod" NOT NULL DEFAULT 'EQUAL_INSTALLMENT',
    "coupon_frequency" "CouponFrequency" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "category_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bonds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bond_schedules" (
    "id" TEXT NOT NULL,
    "bond_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "coupon" DECIMAL(14,2) NOT NULL,
    "principal_return" DECIMAL(14,2) NOT NULL,
    "remaining_principal" DECIMAL(14,2) NOT NULL,
    "generated_tx_id" TEXT,
    "generated_interest_tx_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "bond_schedules_pkey" PRIMARY KEY ("id")
);

-- ============ 待摊/预付 ============
CREATE TABLE "amortization_items" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "ledger_id" TEXT NOT NULL,
    "account_id" TEXT,
    "name" TEXT NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "amortized_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remaining_amount" DECIMAL(14,2) NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "period_months" INTEGER NOT NULL,
    "period_type" "PeriodType" NOT NULL DEFAULT 'MONTHLY',
    "type" "AmortizationType" NOT NULL,
    "category_id" TEXT,
    "source_tx_id" TEXT,
    "note" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "amortization_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "amortization_schedules" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "generated_tx_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "amortization_schedules_pkey" PRIMARY KEY ("id")
);

-- ============ 垫付应收 ============
CREATE TABLE "advance_receivables" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "ledger_id" TEXT NOT NULL,
    "account_id" TEXT,
    "payer_id" TEXT NOT NULL,
    "debtor_name" TEXT NOT NULL,
    "debtor_type" "DebtorType" NOT NULL,
    "source_tx_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "repaid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "remaining_amount" DECIMAL(14,2) NOT NULL,
    "due_date" TIMESTAMP(3),
    "status" "AdvanceStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "advance_receivables_pkey" PRIMARY KEY ("id")
);

-- ============ transactions 扩展列 ============
ALTER TABLE "transactions" ADD COLUMN "advance_of_id" TEXT;
ALTER TABLE "transactions" ADD COLUMN "amortization_item_id" TEXT;

-- ============ loan_schedules 扩展列 ============
ALTER TABLE "loan_schedules" ADD COLUMN "generated_interest_tx_id" TEXT;

-- ============ 外键 ============
ALTER TABLE "bonds"
    ADD CONSTRAINT "bonds_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "bonds_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "bonds_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bond_schedules"
    ADD CONSTRAINT "bond_schedules_bond_id_fkey" FOREIGN KEY ("bond_id") REFERENCES "bonds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "amortization_items"
    ADD CONSTRAINT "amortization_items_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "amortization_items_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "amortization_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "amortization_schedules"
    ADD CONSTRAINT "amortization_schedules_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "amortization_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "advance_receivables"
    ADD CONSTRAINT "advance_receivables_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "advance_receivables_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ledgers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "advance_receivables_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "advance_receivables_source_tx_id_fkey" FOREIGN KEY ("source_tx_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============ 索引 ============
CREATE INDEX "bonds_family_id_idx" ON "bonds"("family_id");
CREATE INDEX "bond_schedules_bond_id_idx" ON "bond_schedules"("bond_id");
CREATE INDEX "bond_schedules_generated_interest_tx_id_idx" ON "bond_schedules"("generated_interest_tx_id");
CREATE INDEX "amortization_items_family_id_idx" ON "amortization_items"("family_id");
CREATE INDEX "amortization_schedules_item_id_idx" ON "amortization_schedules"("item_id");
CREATE INDEX "advance_receivables_family_id_idx" ON "advance_receivables"("family_id");
CREATE INDEX "advance_receivables_ledger_id_idx" ON "advance_receivables"("ledger_id");
CREATE INDEX "advance_receivables_payer_id_idx" ON "advance_receivables"("payer_id");
CREATE INDEX "advance_receivables_status_idx" ON "advance_receivables"("status");
CREATE INDEX "transactions_advance_of_id_idx" ON "transactions"("advance_of_id");
CREATE INDEX "transactions_amortization_item_id_idx" ON "transactions"("amortization_item_id");
CREATE INDEX "loan_schedules_generated_interest_tx_id_idx" ON "loan_schedules"("generated_interest_tx_id");

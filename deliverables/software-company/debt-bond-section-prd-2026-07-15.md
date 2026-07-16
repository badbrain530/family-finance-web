# 「债务/债券板块」产品需求文档（简单 PRD）

> 角色：产品经理（许清楚）。本文档仅描述需求与设计，不改动任何代码/文件。已基于主理人代码盘点与本人抽检（`schema.prisma`、`loans.controller.ts`、`reimbursement.dto.ts`、`net-expense.ts`、`transactions.controller.ts`）核实事实。
> 状态：**待用户确认**（2026-07-15）。确认后进入架构设计（高见远）→ 编码（寇豆码）→ QA（严过关）。

---

## 1. 项目信息
- **Language**：中文
- **技术栈**：前端 React 18 (Vite + Tailwind + shadcn/ui)；后端 NestJS 10 + Prisma 5 + PostgreSQL；交易统一落 `transactions` 表，type ∈ {INCOME, EXPENSE, TRANSFER}
- **Project Name**：`debt_bond_section`
- **原始需求复述（verbatim 整合）**：
  1. 债券债务：若有利息，需生成「利息支出」条目。
  2. 待摊、预付：按周期生成相应的交易条目（摊销）。
  3. 贷款、按揭：按周期生成交易条目，若有利息产生，生成「利息支出」条目。
  4. 垫付、报销：记账时选择是否为报销；若是则不计入支出；报销页可看到未报销条目。

---

## 2. 产品定义

### 2.1 Product Goals（3 个正交目标）
1. **统一入口与视图**：将分散的贷款/按揭、分期、报销，与新增的债券、待摊/预付、垫付，收拢到统一的「债务/债券板块」，一个入口管理所有"负债/应收/待摊"类资金流。
2. **闭环的周期性记账**：所有含利息或需摊销的场景，都能按既定周期自动生成交易条目（本息拆解、利息支出、摊销费用），并跟踪剩余本金/余额，杜绝手工重复录入。
3. **准确的支出口径**：报销类支出按明确规则从净支出统计中排除（或过滤），垫付记为应收而非净流出，确保 Net Expense / 仪表盘真实反映家庭实际现金负担。

### 2.2 用户故事（总览 5 条）
1. As 家庭财务管理者, I want 在统一板块查看贷款/债券/待摊/垫付/报销全貌, so that 不必在多页面间跳转即可掌握所有负债与应收。
2. As 记账用户, I want 录入债券债务后系统自动按期生成含「利息支出」的条目, so that 无需每月手工算息。
3. As 记账用户, I want 预付年费后系统按月生成摊销费用并跟踪未摊销余额, so that 支出能合理分摊到各月。
4. As 记账用户, I want 标记某笔支出为"垫付/报销"并在报销页看到未报销清单, so that 我能追踪谁该还钱、哪笔还没报销。
5. As 家庭决策者, I want 仪表盘净支出自动排除已报销金额并包含利息支出, so that 看到的支出数字真实可信。

---

## 3. 整合复用策略
- **已存在、直接复用（不新建重复模块）**：
  - 贷款/按揭：`loans` 模块（Loan/LoanSchedule + 6 个 REST + `LoansPage.tsx`）已完整实现本息拆解与周期还款生成。
  - 分期付款：`POST /api/transactions/installment` + `CreateInstallmentDto`，一次生成 N 笔 EXPENSE；前端已在交易模块支持。
  - 报销：`Mark/Confirm/CancelReimbursement` + `POST /api/transactions/:id/reimbursement/{mark,cancel,confirm}`；`Transaction.reimbursementStatus`；`ReimbursementsPage.tsx` 已存在。
  - 周期生成引擎：`RecurringRule` 已具备"按频率生成 + `nextRunAt` 游标"能力 → **待摊/预付可复用其生成调度**，仅需额外一张余额跟踪表。
- **缺失、需新增（无模型/接口/UI）**：债券 `bonds`、待摊/预付 `amortizations`、垫付 `advances`。
- **统一衔接点**：所有新增周期条目/利息条目/垫付收款最终都落 `transactions` 表，通过 `*Schedule.generatedTxId` / `Transaction.reimbursementOfId` / 新增 `advanceOfId` 反向关联，保持与现有贷款/报销一致的可追溯性；板块统一导航（P1）把现有页面与新建页面收拢到一个侧栏分组。

---

## 4. 子功能详细设计

### 4.1 债券债务（Bonds）— 新增
- **用户故事**：录入债券债务（发行方视角负债），系统按周期生成还款/付息条目，有利息则生成「利息支出」；若为持有方则生成「利息收入」。
- **核心业务规则**：
  - 创建时指定 `side`（持有方 HELD / 发行方 ISSUED）、面值、年利率、期限、付息频率、还款方式。
  - 创建即计算完整 `BondSchedule`（seq, dueDate, payment, principalPart, interestPart, remainingPrincipal）。
  - 周期生成：对 `status=pending` 的计划调用 `POST /api/bonds/:id/generate` 生成交易条目：
    - 发行方(ISSUED)：整笔还款为 **EXPENSE**；若 `interestPart>0`，**按待确认④决定**拆出独立「利息支出」交易还是保留单笔（金额含息）。
    - 持有方(HELD)：每期票息为 **INCOME**（利息收入）。
  - `generatedTxId` 回写避免重复；`status` 流转 pending→paid/skipped。
- **数据模型草图（新增）**：
  ```
  Bond            (bonds)
    id, familyId, ledgerId, accountId?, name, faceValue(Decimal),
    annualRate(Decimal), termMonths(Int), method(LoanMethod),
    couponFrequency(MONTHLY|QUARTERLY|SEMI|ANNUAL),
    side(HELD|ISSUED), startDate(DateTime), categoryId?, note?, isActive
  BondSchedule    (bond_schedules)
    id, bondId, seq(Int), dueDate, payment(Decimal),
    principalPart(Decimal), interestPart(Decimal),
    remainingPrincipal(Decimal), generatedTxId?(String), status(pending|paid|skipped)
  ```
- **接口清单（新增）**：`GET /api/bonds?familyId=`｜`POST /api/bonds`｜`GET /api/bonds/:id`｜`PUT /api/bonds/:id`｜`DELETE /api/bonds/:id`｜`POST /api/bonds/:id/generate`
- **UI 页面与交互**：`BondsPage.tsx` 列表区分 HELD/ISSUED 标签、显示剩余本金/未付利息、状态徽章；详情抽屉时间轴展示每期本息与状态，"生成交易"按钮预览并生成；新建表单选 side 后动态显隐字段，实时预览首期还款额与利息。

### 4.2 待摊 / 预付（Amortization）— 新增
- **用户故事**：一次性预付年费/长期待摊费用后，系统按月生成摊销费用条目并跟踪未摊销余额。
- **核心业务规则**：
  - 录入记录 `totalAmount`、`periodMonths`、`periodType=MONTHLY`、`type`（PREPAID 预付 / DEFERRED 待摊）。
  - 初始入账：一次性付款生成**单笔 EXPENSE**（或资产登记，口径见待确认②）；后续每期生成**摊销 EXPENSE**，金额 = totalAmount / periodMonths。
  - `AmortizationSchedule` 跟踪每期 `dueDate/amount/generatedTxId/status`；`AmortizationItem.remainingAmount` 随时递减，归零后 `isActive=false`。
  - 复用 `RecurringRule` 的 `nextRunAt` 游标驱动生成（新增表仅做余额与计划快照）。
- **数据模型草图（新增）**：
  ```
  AmortizationItem  (amortization_items)
    id, familyId, ledgerId, accountId?, name, totalAmount(Decimal),
    amortizedAmount(Decimal default 0), remainingAmount(Decimal),
    startDate, periodMonths(Int), periodType(MONTHLY),
    type(PREPAID|DEFERRED), categoryId?, sourceTxId?, note?, isActive
  AmortizationSchedule (amortization_schedules)
    id, itemId, seq(Int), dueDate, amount(Decimal),
    generatedTxId?(String), status(pending|posted|skipped)
  ```
- **接口清单（新增）**：`GET /api/amortizations?familyId=`｜`POST /api/amortizations`｜`GET /api/amortizations/:id`｜`PUT /api/amortizations/:id`｜`DELETE /api/amortizations/:id`｜`POST /api/amortizations/:id/generate`
- **UI 页面与交互**：`AmortizationPage.tsx` 列表显示名称、类型标签、剩余余额进度条、剩余期数；详情摊销时间表（已生成/待生成），"生成本期"创建交易；新建表单输入总额/期数/类型，预览每月摊销额。

### 4.3 贷款 / 按揭（Loans）— 复用 + 衔接
- **用户故事**：已有贷款自动按期生成还款条目，有利息则生成「利息支出」条目（口径与债券统一，见待确认④）。
- **核心业务规则（基于现有）**：`Loan`(principal, annualRate, termMonths, method, startDate) + `LoanSchedule`(seq, dueDate, payment, principalPart, interestPart, remainingPrincipal, generatedTxId, status)。`POST /api/loans/:id/generate` 当前生成**单笔**还款 EXPENSE（`generatedTxId` 指向单笔，金额含息）。
- **数据模型草图（复用）**：`Loan` / `LoanSchedule`（schema.prisma 234/256 行，不新建）。
- **接口清单（复用）**：`GET/POST/GET:id/PUT:id/DELETE:id /api/loans` + `POST /api/loans/:id/generate`（均已有）。
- **UI 页面与交互**：复用 `LoansPage.tsx`；板块内仅增加入口与"利息支出"标识展示。

### 4.4 垫付（Advances）— 新增
- **用户故事**：代他人付款后记为应收，归还时生成收款交易冲销，并在"垫付"页跟踪未收回金额。
- **核心业务规则**：
  - 记账时选择"垫付"并填 `debtorName`/`debtorType`（个人/公司/家庭），源支出 `sourceTxId` 关联。
  - 垫付本身为真实 **EXPENSE**（与报销不同，见 4.5）；系统登记一笔 `AdvanceReceivable`（应收）。
  - 对方归还：`POST /api/advances/:id/collect` 生成 **INCOME** 收款交易（`advanceOfId` 指向该应收），`repaidAmount`/`remainingAmount` 更新；可部分归还。
  - `status` 流转 PENDING→PARTIAL→RECOVERED / CANCELLED。
- **数据模型草图（新增）**：
  ```
  AdvanceReceivable (advance_receivables)
    id, familyId, ledgerId, accountId?, payerId(userId),
    debtorName(String), debtorType(PERSON|COMPANY|FAMILY),
    sourceTxId(String), amount(Decimal),
    repaidAmount(Decimal default 0), remainingAmount(Decimal),
    dueDate?(DateTime), status(PENDING|PARTIAL|RECOVERED|CANCELLED), note?
  ```
  - `Transaction` 新增可选字段 `advanceOfId?(String)`（收款反向交易，复用 `reimbursementOfId` 模式）。
- **接口清单（新增）**：`GET /api/advances?familyId=`（支持 status 过滤）｜`POST /api/advances`｜`GET /api/advances/:id`｜`PUT /api/advances/:id`｜`DELETE /api/advances/:id`｜`POST /api/advances/:id/collect`
- **UI 页面与交互**：`AdvancesPage.tsx` 列表显示债务人、金额、已收回/未收回、状态，"未收回"筛选突出；详情源支出+收款流水，"登记收回"输入金额生成收款交易；记账表单衔接：交易创建页新增"垫付"开关与债务人字段（复用 `POST /api/transactions`）。

### 4.5 报销（Reimbursement）— 复用 + 补口径
- **用户故事**：记账时选择"是否报销"，若是则不计入支出；报销页可看到未报销条目。
- **核心业务规则（基于现有 + 待定）**：
  - 现有：`mark` 置 `reimbursementStatus=PENDING`（不生成交易）；`confirm` 生成 **INCOME** 反向交易（`reimbursementOfId` 指向原支出），原交易置 `REIMBURSED`；`source: family|company`。
  - **"不计入支出"记账口径（待确认⑤）**：当前 `net-expense.ts` 净支出 = 原支出 − 退款，**报销收入不冲减支出**（独立计入总收入）。需确认"不计入支出"是 (a) 统计排除（Net Expense 排除已 REIMBURSED 金额）还是 (b) 连交易列表都不显示。
  - **未报销视图口径**：报销页展示 `reimbursementStatus=PENDING` 的条目；`confirm` 后移出未报销清单。
- **数据模型草图（复用）**：`Transaction.reimbursementOfId`/`reimbursementStatus`（已存在）；`ReimbursementsPage.tsx` 已存在，仅需补"未报销"过滤与"不计入支出"统计联动。
- **接口清单（复用）**：`POST /api/transactions/:id/reimbursement/{mark,cancel,confirm}`（已有）；记账创建 `POST /api/transactions` 增加 `isReimbursement` 标记入参（小改）。
- **UI 页面与交互**：复用 `ReimbursementsPage.tsx`；记账表单增加"报销"开关；未报销 Tab 默认展示 PENDING。

---

## 5. 需求池（P0 / P1 / P2）

**P0（Must have）**
- P0-1 垫付模块：新增 `AdvanceReceivable` 模型 + `advances` 接口 + `AdvancesPage` + 记账表单"垫付"开关（含收款冲销 INCOME 交易）。
- P0-2 报销"不计入支出"记账口径落地 + 未报销视图（基于现有 reimbursement 接口，补统计/过滤）。
- P0-3 待摊/预付模块：新增 `AmortizationItem`/`AmortizationSchedule` + 接口 + `AmortizationPage` + 复用 RecurringRule 生成。
- P0-4 债券债务模块：新增 `Bond`/`BondSchedule` + 接口 + `BondsPage` + 周期付息/还款生成（含利息条目）。

**P1（Should have）**
- P1-1 板块统一导航/入口：侧栏"债务/债券"分组收拢 Loans / Bonds / Amortization / Advances / Reimbursements 五页。
- P1-2 周期预览：各子功能详情页提供"未来 N 期"预览（dueDate/金额/利息），生成前可确认。
- P1-3 利息/摊销条目与源计划双向追溯（`generatedTxId` 点击跳转交易详情）。

**P2（Nice to have）**
- P2-1 统计/报表联动：Net Expense 排除报销（按待确认⑤决策）、含利息支出/摊销费用；仪表盘增加"负债/应收/待摊"卡片。
- P2-2 板块汇总接口 `GET /api/debt-bond/summary`：总负债、总应收、本月利息支出、未摊销余额。
- P2-3 批量生成（月末一键生成所有到期计划）。

---

## 6. UI 设计稿描述（文字）
- **板块总览（债务/债券 首页）**：顶部 KPI 卡片（总负债、总应收、本月待生成条目数、未报销金额）；下方 Tab 切换 贷款/按揭 · 债券 · 待摊预付 · 垫付 · 报销；每 Tab 为对应列表。
- **列表页通用布局**：左筛选栏（状态/类型/债务人），右卡片/表格列表（名称、金额、剩余、状态徽章、操作"生成/详情"）；顶部"新建"按钮。
- **详情抽屉**：左侧计划时间轴（期数、dueDate、本金/利息/摊销额、状态），右侧操作区（生成本期、查看已生成交易）；债券/贷款额外显示"利息支出"聚合。
- **新建/编辑表单**：分步骤（基础信息 → 周期参数 → 实时预览首期金额/利息/每月摊销）；垫付表单含债务人字段；报销在记账表单以开关呈现。
- **未报销 / 未收回视图**：独立筛选态或 Tab，红点/角标提示待处理数量。

---

## 7. 待确认问题（Open Questions）
1. **债券视角**：债券是"持有方（应收利息，资产）"还是"发行方（应付利息，负债）"还是两者都要？当前需求 #1 偏向发行方（利息支出），但持有方场景是否纳入本期需明确。
2. **待摊 vs 预付**：是否为同一机制仅方向相反？建议合并为 `AmortizationItem.type ∈ {PREPAID, DEFERRED}` 共用一套生成与余额逻辑，请确认。
3. **垫付归还交易**：垫付归还时是否生成收款交易（INCOME, `advanceOfId` 关联）？还是仅更新应收余额、不落交易？建议生成收款交易以保持现金流完整。
4. **利息条目形态**：贷款/债券的"利息支出"是**拆出独立交易**（本金一笔 EXPENSE + 利息一笔 EXPENSE）还是**保留单笔**（还款交易金额含息，仅分类/标签标记利息部分）？当前 `LoanSchedule` 已拆出 `interestPart`，但 `generatedTxId` 仅指向单笔，需统一决策（影响债券与贷款两端）。
5. **报销"不计入支出"语义**：是指 (a) 统计排除（Net Expense 不计入已 REIMBURSED 的支出，当前 `net-expense.ts` 不冲减报销）还是 (b) 连交易列表都不显示该笔支出？二者影响范围不同（统计层 vs 展示层），需明确。

---
**附：已核实代码事实**（支撑上述复用判断）
- `Loan`/`LoanSchedule` 模型与 6 个 `/api/loans` 接口完整存在；`interestPart` 已拆分但还款为单笔 `generatedTxId`（对应待确认④）。
- 报销 `mark`/`confirm` 已存在；`net-expense.ts` 明确"报销收入不冲减支出"——即当前口径为 (a) 统计不排除，待确认⑤需定夺。
- 分期 `POST /api/transactions/installment` 已存在；`RecurringRule` 可作待摊/预付生成引擎。
- `bonds` / `amortizations` / `advances` 在任何模型/接口/UI 中均不存在（确认新增）。

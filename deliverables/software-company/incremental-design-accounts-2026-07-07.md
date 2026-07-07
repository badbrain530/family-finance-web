# 增量架构设计文档（Incremental Design）
**迭代主题**：账户管理补全 + 分类前端 + 交易编辑闭环 + 深色模式 + 通知中心
**文档版本**：v1.0
**日期**：2026-07-07
**作者**：架构师（architect-agent）
**配套 PRD**：`deliverables/software-company/incremental-prd-accounts-2026-07-07.md`
**适用范围**：仅描述本次迭代新增/变更的增量部分；已有模块仅列受影响点。

---

## 1. 实现方案 + 框架选型

### 1.1 技术栈（沿用，不引入新框架）
| 层 | 选型 | 说明 |
| --- | --- | --- |
| 前端 | React 18 + Vite + TypeScript + Tailwind CSS + shadcn 风格 UI 组件（`frontend/src/components/ui/*`） | 沿用现有组件库（Dialog/Select/Input/Button/Toast）。新增页面沿用 `lazy` 路由 + `AppLayout`。 |
| 后端 | NestJS 10 + TypeScript | 沿用模块范式：`module / controller / service / dto`，全局前缀 `/api`，`ValidationPipe`（whitelist + forbidNonWhitelisted + transform），`TransformInterceptor`（响应统一为 `{code,data,message}`），`HttpExceptionFilter`，全局 JWT 守卫（`@Public()` 可跳过）。 |
| 数据 | PostgreSQL 16 + Prisma 5（`@prisma/client`、`prisma`） | 沿用 `PrismaModule`、`FamiliesModule` 注入模式。 |
| 状态 | zustand（frontend `src/store/*`，`persist` 中间件） | 沿用 `uiStore`（主题/侧边栏）、`notificationStore`（未读）。 |

### 1.2 增量改动要点（按 PRD + 主理人拍板决策）
1. **账户维度**：新增 `Account` 模型 + `AccountType` 枚举；`Transaction` 新增可空 `accountId`。存量交易 `accountId` 允许为空（**决策#1**），历史交易显示"未指定账户"，**不写回填脚本**。
2. **余额口径**：本期 `account.balance` 为手填展示值，**不做余额自动联动**（**决策#2**，推迟 P1-3）。信用卡 `availableCredit` 由后端在创建/更新时按 `creditLimit - balance` 计算后存储展示（非实时联动交易）。
3. **清除数据**：仅"清空全部交易"`POST /api/transactions/clear`，保留账户/分类/预算/设置；**本期不做"删除账户"**（**决策#3**）。
4. **账本关系**：`Account.ledgerId` 可选（`String?`），共同账户可为 `null`（**决策#4**）。
5. **通知中心**：前端对接**已存在**的后端 `notifications` 模块（`GET /api/notifications`、`PUT /api/notifications/:id/read`、`PUT /api/notifications/read-all`、`GET /api/notifications/unread-count`），**不补后端通知生成逻辑**（**决策#5**）。
6. **移动端**：本期仅补桌面端 `Sidebar` 入口，**不改 `MobileNav`**（**决策#6**）。

---

## 2. 数据模型变更

### 2.1 `schema.prisma` 需新增/修改内容
在现有 `schema.prisma` 末尾枚举区**新增** `AccountType` 枚举，在 `model Transaction` **新增** `accountId` 字段与关联，**新增** `model Account`。

```prisma
// ==================== 新增枚举：账户类型 ====================
enum AccountType {
  DEBIT       // 储蓄卡
  CREDIT      // 信用卡
  INVESTMENT  // 投资
  CASH        // 现金
  E_WALLET    // 钱包（支付宝/微信）
  VIRTUAL     // 虚拟
}

// ==================== 新增模型：账户 ====================
model Account {
  id              String      @id @default(uuid())
  familyId        String      @map("family_id")
  ledgerId        String?     @map("ledger_id")                  // 归属账本，共同账户可为null（决策#4）
  userId          String      @map("user_id")                   // 创建者
  type            AccountType
  name            String
  balance         Decimal     @db.Decimal(12, 2)                // 储蓄/投资/现金/钱包/虚拟=余额；信用卡=当前欠款
  institution     String?                                        // 机构（储蓄卡/信用卡）
  lastFourDigits  String?     @map("last_four_digits")          // 卡号后4位
  creditLimit     Decimal?    @db.Decimal(12, 2) @map("credit_limit")    // 信用卡授信额度
  billingDay      Int?        @map("billing_day")               // 1-28
  paymentDueDay   Int?        @map("payment_due_day")           // 1-28
  availableCredit Decimal?    @db.Decimal(12, 2) @map("available_credit") // 信用卡可用额度=授信-欠款（后端计算存储）
  platform        String?                                        // 投资/钱包平台
  purpose         String?                                        // 虚拟账户用途
  currency        String      @default("CNY")
  isActive        Boolean     @default(true)  @map("is_active") // 停用不删除（决策#3）
  createdAt       DateTime    @default(now()) @map("created_at")
  updatedAt       DateTime    @updatedAt       @map("updated_at")

  // 关联
  family       Family       @relation(fields: [familyId], references: [id])
  creator      User         @relation(fields: [userId], references: [id])
  transactions Transaction[] @relation("AccountTransactions")

  @@index([familyId])
  @@index([ledgerId])
  @@map("accounts")
}
```

```prisma
// ==================== 修改模型：Transaction 新增账户关联 ====================
model Transaction {
  // ... 现有字段保持不变 ...
  accountId  String?  @map("account_id")
  account    Account? @relation("AccountTransactions", fields: [accountId], references: [id])

  // 在现有 @@index 区块中新增：
  @@index([accountId])
}
```

### 2.2 迁移方式（docker compose postgres 环境）
本项目使用 Prisma，**不写自定义回填脚本**（决策#1，`accountId` 可空）。推荐用 `prisma migrate dev` 生成可审计迁移；紧急情况可用 `prisma db push`。

**步骤（在后端容器内执行，确保 `DATABASE_URL` 指向 postgres 服务）：**

```bash
# 1) 进入后端容器（docker compose 已启动 postgres/redis/backend）
cd /path/to/家庭财务软件开发
docker compose exec backend sh

# 2) 生成迁移（自动写入 migrations/ 并应用到库，同时生成 Prisma Client）
npx prisma migrate dev --name add_account_and_txn_account

# 3) 确认 client 已生成（migrate dev 会自动 generate；如未执行可补）
npx prisma generate

# 退出容器
exit
```

> 若数据库在容器外本地直连，可宿主机执行：
> ```bash
> cd backend
> npx prisma migrate dev --name add_account_and_txn_account
> ```
> 需保证 `.env` 中 `DATABASE_URL=postgresql://family_finance:family_finance_pwd@localhost:5432/family_finance?schema=public`（与 `docker-compose.yml` 中 `postgres` 服务凭据一致）。

**注意**：`availableCredit` 等 Decimal 字段在 JSON 序列化时 Prisma 会转为字符串；后端 service 返回前需 `Number(decimal)` 转为数值（见 §8）。

---

## 3. 文件列表及相对路径

### 3.1 后端新增/修改
| 动作 | 相对路径 | 说明 |
| --- | --- | --- |
| 新增 | `backend/src/modules/accounts/accounts.module.ts` | 模块定义，imports: `PrismaModule, FamiliesModule` |
| 新增 | `backend/src/modules/accounts/accounts.controller.ts` | 账户 CRUD + deactivate |
| 新增 | `backend/src/modules/accounts/accounts.service.ts` | 业务逻辑 + 按 family 隔离 + availableCredit 计算 |
| 新增 | `backend/src/modules/accounts/dto/create-account.dto.ts` | 创建 DTO（class-validator） |
| 新增 | `backend/src/modules/accounts/dto/update-account.dto.ts` | 更新 DTO（全字段可选） |
| 修改 | `backend/src/app.module.ts` | 注册 `AccountsModule` |
| 修改 | `backend/src/modules/transactions/transactions.controller.ts` | 新增 `POST /api/transactions/clear` |
| 修改 | `backend/src/modules/transactions/transactions.service.ts` | 新增 `clearAllTransactions(familyId)` |
| 新增 | `backend/src/modules/transactions/dto/clear-transactions.dto.ts` | `{ familyId, confirm }` |

> 说明：`categories` 后端已完整，本期前端直接对接；无需后端改动。`notifications` 后端已完整，本期仅前端对接。

### 3.2 前端新增/修改
| 动作 | 相对路径 | 说明 |
| --- | --- | --- |
| 新增 | `frontend/src/types/account.ts` | `AccountType` 枚举、`Account` 接口、`CreateAccountRequest/UpdateAccountRequest` |
| 修改 | `frontend/src/types/index.ts` | `export * from './account'` |
| 新增 | `frontend/src/services/account.service.ts` | 账户 CRUD + deactivate |
| 新增 | `frontend/src/services/notification.service.ts` | 通知列表/未读/已读（对接已有后端） |
| 修改 | `frontend/src/services/category.service.ts` | **修正路径**为 `/categories?familyId=`（见 §8 坑点） |
| 新增 | `frontend/src/features/accounts/AccountsPage.tsx` | 账户总览页（分组卡片 + 净资产汇总） |
| 新增 | `frontend/src/features/accounts/AccountFormDrawer.tsx` | 新建/编辑抽屉（按类型动态字段） |
| 新增 | `frontend/src/features/categories/CategoriesManagePage.tsx` | 分类管理树形页 |
| 新增 | `frontend/src/features/notifications/NotificationsPage.tsx` | 通知中心页 |
| 修改 | `frontend/src/features/transactions/EditTransactionModal.tsx` | 新增"账户"必选字段；分类改真实 API |
| 修改 | `frontend/src/features/transactions/QuickRecordModal.tsx` | 快捷记账新增"账户"必选 |
| 修改 | `frontend/src/features/settings/SettingsPage.tsx` | `handleClearAllData` 调用真实接口 |
| 修改 | `frontend/src/components/layout/Sidebar.tsx` | `iconMap` 增加 `Tags/Landmark` 等；入口已在 `NAV_ITEMS` 增加 |
| 修改 | `frontend/src/App.tsx` | 路由 `/accounts`、`/categories`、真实 `/notifications`；移除 `NotificationsPlaceholder` |
| 修改 | `frontend/src/lib/constants.ts` | `NAV_ITEMS` 增加"账户/分类"；新增 `ACCOUNT_TYPE_META`（枚举↔中文/图标/颜色映射） |
| 修改 | `frontend/src/index.css` | 新增 `.dark { /* 深色变量覆写 */ }` 及必要 `dark:` 适配 |
| 修改 | `frontend/src/store/uiStore.ts` | `setTheme`/`toggleTheme` 已持久化；新增在 `AppLayout` 挂载时 apply `document.documentElement.classList` |

---

## 4. 接口定义（后端新增/修改）

> 全部位于全局前缀 `/api` 之下；请求体经 `ValidationPipe` 校验（白名单）；响应经 `TransformInterceptor` 包装为 `{ code, data, message }`（前端拦截器已按 `code===0` 取 `data`）。鉴权：需 JWT（全局 `JwtAuthGuard`）。`familyId` 由前端经 `getCurrentFamily()` 获取后传入，后端按用户家庭归属校验。

### 4.1 账户（新增 `accounts` 模块）
| 方法 | 路径 | 说明 | 请求体 | 响应 `data` |
| --- | --- | --- | --- | --- |
| GET | `/api/accounts?familyId=` | 账户列表（按类型、创建时间排序） | query: `familyId: string` | `Account[]` |
| GET | `/api/accounts/:id` | 账户详情 | — | `Account` |
| POST | `/api/accounts` | 新建账户 | `CreateAccountRequest` | `Account` |
| PATCH | `/api/accounts/:id` | 编辑账户 | `UpdateAccountRequest` | `Account` |
| POST | `/api/accounts/:id/deactivate` | 停用/启用（`isActive` 翻转） | — | `{ id, isActive }` |

**CreateAccountRequest（JSON）**
```json
{
  "familyId": "uuid",
  "type": "DEBIT",                 // DEBIT|CREDIT|INVESTMENT|CASH|E_WALLET|VIRTUAL
  "name": "招行储蓄卡",
  "balance": 12850.00,
  "institution": "招商银行",        // DEBIT/CREDIT 必填建议
  "lastFourDigits": "8821",         // 4位数字
  "creditLimit": null,              // CREDIT 用
  "billingDay": null,               // 1-28
  "paymentDueDay": null,
  "platform": null,                 // INVESTMENT/E_WALLET 用
  "purpose": null,                  // VIRTUAL 用
  "currency": "CNY",
  "ledgerId": null                  // 可选
}
```
**UpdateAccountRequest**：上述字段全部可选（含 `isActive` 也可经 PATCH 改，但停用走专用端点）。

**账户响应示例**
```json
{
  "id": "a1",
  "familyId": "f1",
  "ledgerId": null,
  "userId": "u1",
  "type": "CREDIT",
  "name": "招行信用卡",
  "balance": 3200.00,
  "institution": "招商银行",
  "lastFourDigits": "4392",
  "creditLimit": 20000.00,
  "billingDay": 5,
  "paymentDueDay": 23,
  "availableCredit": 16800.00,
  "platform": null,
  "purpose": null,
  "currency": "CNY",
  "isActive": true,
  "createdAt": "2026-07-07T10:00:00Z",
  "updatedAt": "2026-07-07T10:00:00Z"
}
```

### 4.2 清空全部交易（修改 `transactions` 模块）
| 方法 | 路径 | 说明 | 请求体 | 响应 `data` |
| --- | --- | --- | --- | --- |
| POST | `/api/transactions/clear` | 仅删交易，保留账户/分类/预算/设置 | `{ "familyId": "uuid", "confirm": true }` | `{ "deleted": number }` |

> 二次确认：`confirm !== true` 时返回 `VALIDATION_ERROR`。后端按 `familyId` 删除该家庭全部 `Transaction`（不触发级联删账户）。

### 4.3 通知（对接已有 `notifications` 模块，前端新增 service）
| 方法 | 路径 | 说明 | 响应 `data` |
| --- | --- | --- | --- |
| GET | `/api/notifications?unreadOnly=&type=&page=&pageSize=` | 列表（分页+筛选） | `{ items: Notification[], total, unreadCount, page, pageSize }` |
| GET | `/api/notifications/unread-count` | 未读数 | `{ count: number }` |
| PUT | `/api/notifications/:id/read` | 单条已读 | `Notification` |
| PUT | `/api/notifications/read-all` | 批量已读（`{ids?:string[]}`，空=全部） | `{ success: true }` |

> 后端 `NotificationType` 为大写（`BUDGET_WARNING` 等），与前端 `types/notification.ts` 的小写枚举不一致，前端需在展示/跳转映射时做大小写归一（见 §8）。

---

## 5. 程序调用流程（关键时序）

### 5.1 新建账户
```
用户(前端 AccountsPage)
  → 点击"＋ 添加账户" → AccountFormDrawer 打开
  → 选择类型(DEBIT) → 动态渲染字段 → 填写机构/后4位/余额
  → 提交 → account.service.createAccount(dto)
  → POST /api/accounts
  → AccountsController.createAccount → AccountsService.createAccount
       · 校验 familyId 属于当前用户家庭（FamiliesModule）
       · type=CREDIT 时 availableCredit = creditLimit - balance
       · prisma.account.create
  → 返回 Account → 前端乐观刷新列表 + toast 成功
```

### 5.2 编辑交易时选择账户
```
用户(前端 TransactionListPage → EditTransactionModal)
  → 打开弹窗时：并行加载 getAccounts(familyId) 与 getCategories(familyId)
  → 账户 Select 选项来自真实 API（必填校验）
  → 分类 Select 由"前端常量"改为"真实 API 树形"（按交易类型过滤一级/二级）
  → 保存 → updateTransaction(id, { accountId, categoryId, ... })
  → PUT /api/transactions/:id
  → 后端 UpdateTransactionDto 增加 accountId?: string|null（已加入白名单）
  → 返回 Transaction → 列表刷新，账户列/详情同步
```

### 5.3 清除数据
```
用户(前端 SettingsPage → 二次确认 Dialog)
  → 点击"清除所有交易" → handleClearAllData()
  → transaction.service.clearAll({ familyId, confirm:true })
  → POST /api/transactions/clear
  → TransactionsController.clearAll → TransactionsService.clearAllTransactions(familyId)
       · prisma.transaction.deleteMany({ where: { ledger: { familyId } } })
  → 返回 { deleted } → 前端 toast + 刷新交易列表/仪表盘
```

### 5.4 通知中心
```
用户(前端 Header 铃铛 / Sidebar 通知中心)
  → 进入 /notifications → NotificationsPage
  → 挂载时 notification.service.getNotifications() + getUnreadCount()
  → 列表渲染（按 type 配图标/颜色，按 data 配跳转路由）
  → 点单条 → markAsRead(id) → 跳转 data.route
  → 点"全部已读" → markAllAsRead() → 更新 notificationStore.unreadCount + 顶栏红点
```

### 5.5 深色模式
```
用户(前端 SettingsPage 主题切换)
  → uiStore.setTheme('dark')
  → AppLayout 监听 theme → document.documentElement.classList.add('dark')
  → index.css 中 .dark 变量覆写生效 → Tailwind dark: 类 + CSS 变量驱动全站换肤
  → 偏好经 persist 中间件写入 localStorage（STORAGE_KEYS.THEME），下次启动恢复
```

---

## 6. 任务列表（有序、含依赖关系）

> 约定：后端任务在前；前端任务依赖对应后端接口契约（T_backend_* 完成后才能 T_frontend_*）。按实现顺序排列。

### 阶段 A：数据层（后端）
- **T-A1** 修改 `schema.prisma`：新增 `AccountType` 枚举、`Account` 模型，`Transaction` 增加 `accountId` 与关联/索引。依赖：无。
- **T-A2** 执行迁移：`docker compose exec backend npx prisma migrate dev --name add_account_and_txn_account` + `prisma generate`。依赖：T-A1。

### 阶段 B：账户后端模块
- **T-B1** 编写 `accounts/dto/create-account.dto.ts`、`update-account.dto.ts`（class-validator，含 `familyId`、`type` 枚举、`lastFourDigits` 4位数字、正数校验）。依赖：T-A1。
- **T-B2** 编写 `accounts/accounts.service.ts`（CRUD、family 隔离校验、CREDIT 的 `availableCredit=creditLimit-balance` 计算、Decimal→number 转换、deactivate 翻转 `isActive`）。依赖：T-B1, T-A2。
- **T-B3** 编写 `accounts/accounts.controller.ts`（`GET /accounts`、`GET /accounts/:id`、`POST /accounts`、`PATCH /accounts/:id`、`POST /accounts/:id/deactivate`）。依赖：T-B2。
- **T-B4** 编写 `accounts/accounts.module.ts`（`imports:[PrismaModule, FamiliesModule]`），并在 `app.module.ts` 注册 `AccountsModule`。依赖：T-B3。

### 阶段 C：清除交易后端
- **T-C1** 编写 `transactions/dto/clear-transactions.dto.ts`（familyId + confirm），在 `transactions.controller.ts` 增加 `POST /transactions/clear`，在 `transactions.service.ts` 增加 `clearAllTransactions(familyId)`（`deleteMany` 按 family）。依赖：T-A2。

### 阶段 D：前端基础（类型/常量/服务/路由）
- **T-D1** 新增 `types/account.ts`（`AccountType` 枚举与后端字符串值一致、`Account`、`Create/UpdateAccountRequest`），并在 `types/index.ts` 导出。依赖：T-B2（契约）。
- **T-D2** 新增 `services/account.service.ts`（getAccounts/createAccount/updateAccount/deactivateAccount，路径 `/accounts`）。依赖：T-D1, T-B4。
- **T-D3** 修改 `lib/constants.ts`：`NAV_ITEMS` 增加"账户"(Wallet)、"分类"(Tags)；新增 `ACCOUNT_TYPE_META`（枚举↔中文名/图标/颜色）。依赖：无。
- **T-D4** 修改 `App.tsx`：新增 `/accounts`、`/categories` 懒加载路由；将 `/notifications` 指向真实 `NotificationsPage`（移除 `NotificationsPlaceholder`）。依赖：T-D3（NAV 文案一致即可并行）。
- **T-D5** 修改 `index.css`：新增 `.dark` 变量覆写 + 必要 `dark:` 适配；修改 `uiStore`/`AppLayout` 在 theme 变化时 apply `document.documentElement.classList`。依赖：无。

### 阶段 E：前端页面
- **T-E1** 实现 `features/accounts/AccountsPage.tsx` + `AccountFormDrawer.tsx`（净资产汇总、按类型分组卡片、动态字段、信用卡可用额度/距还款日展示、停用操作）。依赖：T-D2。
- **T-E2** 修正 `services/category.service.ts` 路径为 `/categories?familyId=`（见 §8 坑点）；实现 `features/categories/CategoriesManagePage.tsx`（树形、二级增删改查、系统分类锁、初始化引导）。依赖：无（后端已存在）。
- **T-E3** 新增 `services/notification.service.ts` + 实现 `features/notifications/NotificationsPage.tsx`（列表/未读筛选/单条+全部已读/类型图标跳转/红点联动 `notificationStore`）。依赖：无（后端已存在）。
- **T-E4** 改造 `EditTransactionModal.tsx`：新增"账户"必选 Select（`getAccounts`）、分类改为真实 API 树形（`getCategories`）、`UpdateTransactionRequest` 增加 `accountId`。依赖：T-D2, T-E2。
- **T-E5** 改造 `QuickRecordModal.tsx`：强制选账户（与 Edit 一致）。依赖：T-D2。
- **T-E6** 改造 `SettingsPage.tsx`：`handleClearAllData` 调用 `transaction.service.clearAll({familyId, confirm:true})` + toast/刷新。依赖：T-C1。
- **T-E7** 全站深色模式走查（仪表盘/交易/导入/家庭/预算/月报/设置/通知），消除刺眼白块。依赖：T-D5。

### 依赖摘要
- 后端：T-A1 → T-A2 → (T-B1→T-B2→T-B3→T-B4)、(T-C1)。
- 前端：后端契约就绪后 → T-D1/D-D2；页面 T-E1 依赖 T-D2；T-E4 依赖 T-D2+T-E2；T-E6 依赖 T-C1。
- 可并行：T-D3/T-D4/T-D5/T-E2/T-E3 与后端解耦，可提前启动。

---

## 7. 依赖包列表

**无新增依赖。**
- 后端：`@prisma/client`、`prisma`、`class-validator`、`class-transformer`、`@nestjs/common` 均已在 `package.json`。`Decimal` 用 Prisma 自带类型，无需额外包。
- 前端：`axios`（已有请求封装）、`zustand`（已有）、`lucide-react`（图标已有：`Wallet`/`Tags`/`CreditCard`/`TrendingUp`/`Banknote`/`Sparkles`/`PiggyBank` 等）、`react-router-dom`（已有）。无需安装新包。

---

## 8. 共享知识（跨文件约定）

1. **账户类型枚举前后端一致性**
   - 后端（`schema.prisma` `AccountType`）：`DEBIT | CREDIT | INVESTMENT | CASH | E_WALLET | VIRTUAL`（大写字符串）。
   - 前端（`types/account.ts` `AccountType`）：同上字符串值；`lib/constants.ts` 的 `ACCOUNT_TYPE_META` 作为**唯一映射源**，结构：
     ```ts
     export const ACCOUNT_TYPE_META: Record<AccountType, { label: string; icon: string; color: string }> = {
       DEBIT:      { label: '储蓄卡',  icon: 'CreditCard', color: '#00C896' },
       CREDIT:     { label: '信用卡',  icon: 'CreditCard', color: '#F59E0B' },
       INVESTMENT: { label: '投资',    icon: 'TrendingUp', color: '#6366F1' },
       CASH:       { label: '现金',    icon: 'Banknote',   color: '#10B981' },
       E_WALLET:   { label: '钱包',    icon: 'Wallet',     color: '#3B82F6' },
       VIRTUAL:    { label: '虚拟',    icon: 'Sparkles',   color: '#A855F7' },
     };
     ```
   - `Sidebar.iconMap` 需补充 `Tags`(分类)、`PiggyBank`(预算，替代原 Wallet 以避免与账户重图) 等 lucide 图标。

2. **API 基础路径**
   - 后端全局前缀 `/api`（`main.ts` `setGlobalPrefix('api')`）。
   - 前端 `API_BASE_URL = VITE_API_BASE_URL || 'http://localhost:3001/api'`，service 内只写相对路径（如 `/accounts`、`/transactions/clear`、`/categories`）。

3. **Decimal / 数值序列化**
   - Prisma `Decimal` 经 JSON 变为字符串。后端 `accounts.service.ts` 返回前将 `balance/creditLimit/availableCredit` 用 `Number(x)` 转为数值，前端以 `number` 接收与展示（金额统一 `toFixed(2)`）。

4. **familyId 获取方式（前端统一约定）**
   - 账户/分类等家庭维度接口需 `familyId`；前端先调用 `family.service.getCurrentFamily()` 取 `family.id`，再传入。`@CurrentUser()` 仅提供 `{userId, nickname}`，**不含 familyId**（见 `current-user.decorator.ts`），后端一律以入参 `familyId` + 用户家庭归属校验隔离。

5. **分类树数据结构**
   - `Category` 含 `parentId` 与 `children?: Category[]`（树形）。`getCategories(familyId)` 返回一级（8大类，`parentId=null`）+ 嵌套 `children` 二级。交易编辑分类下拉按交易 `type`（income/expense）过滤一级节点后展开二级。

6. **错误码（沿用 `ERROR_CODES`）**
   - `SUCCESS:0`、`VALIDATION_ERROR:1001`（含 confirm 校验失败）、`FORBIDDEN:1003`（family 越权）、`NOT_FOUND:1004`。前端 `api.ts` 拦截器已按 `code` 抛错，页面用 `toast` 展示 `err.message`。

7. **通知类型大小写归一（坑点）**
   - 后端 `NotificationType` 返回**大写**（`BUDGET_WARNING`…），前端 `types/notification.ts` 枚举为**小写**（`budget_warning`…）。`NotificationsPage` 展示/跳转映射须以"后端返回的原始字符串"为键（或统一 `toUpperCase()` 后再查 `NOTIFICATION_META`），避免匹配失效。

8. **⚠️ 分类接口路径坑点（需修复）**
   - 现有 `category.service.ts` 调用 `/families/${familyId}/categories`，但后端 `categories` 模块实际暴露的是 `GET /api/categories?familyId=`（见 `categories.controller.ts`）。**本期 T-E2 必须修正**为 `get('/categories', { familyId })`，否则分类管理页与交易编辑真实分类均无法拉取。

---

## 9. 待明确事项（技术上仍不确定、会影响实现的点）

1. **分类接口路径真相**：前述坑点（§8.8）疑似前后端历史不一致。若后端另存在 `/families/:id/categories` 路由（当前 grep 未发现），则以实际路由为准；实现前需后端同学确认唯一正确路径，前端据此对齐。
2. **账户列表按"当前家庭"还是"全部可见家庭"**：本期默认仅当前 `familyId`；若家庭协同场景下需跨账本可见，需明确 `ledgerId` 过滤策略（决策#4 已定可选，但列表是否按 ledger 细分未定）。
3. **信用卡 `balance` 语义**：本期按 PRD 约定"balance=当前欠款"，`availableCredit=creditLimit-balance`。若产品希望 balance 表示"已用额度"或"剩余应还"，需与财务口径再确认（影响 P1-3 联动方向）。
4. **通知生成是否完全缺失**：决策#5 明确本期不补后端通知生成；但若现有业务节点（大额/预算/月报/导入/成员加入）从未写入 `Notification` 表，则通知中心初期为空。是否需要在上线说明中提示用户"历史通知不会回填"——属产品文案决策，不阻塞开发。
5. **顶栏铃铛红点现状**：需确认 `Header` 当前是否已调用 `unread-count` 并绑定 `notificationStore.unreadCount`；若未接，通知中心页内"全部已读"后顶栏红点可能不更新（不影响页面内逻辑，仅顶栏指示）。
6. **停用账户的展示归属**：决策#3 不做删除，停用账户仍保留。列表/总览是否将 `isActive=false` 账户折叠到"已停用"分组、是否计入净资产——建议总览包含但单独标注，待 UI 细节确认（不影响接口）。

---

## 附：交付物与验收映射（对应 PRD §6 DoD）
- `Account` 模型 + 迁移（T-A1/A2）→ DoD[账户模型上线]
- `/accounts` 前后端（T-B* + T-E1）→ DoD[账户页/表单]
- `/categories` 前端（T-E2）→ DoD[分类管理]
- 编辑/快捷记账账户必选 + 真实分类（T-E4/E5）→ DoD[交易编辑闭环]
- `POST /transactions/clear`（T-C1 + T-E6）→ DoD[清除数据真实生效]
- `.dark` CSS（T-D5/E7）→ DoD[深色模式全站]
- 通知中心（T-E3）→ DoD[通知列表/已读/红点/跳转]

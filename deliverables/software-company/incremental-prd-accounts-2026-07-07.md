# 增量产品需求文档（Incremental PRD）
**迭代主题**：账户管理补全 + 分类前端 + 交易编辑闭环 + 深色模式 + 通知中心
**文档版本**：v1.0
**日期**：2026-07-07
**作者**：产品经理（pm-agent）
**适用范围**：仅描述本次迭代需要新增/变更的增量部分；已有模块（仪表盘、交易管理、账单导入、家庭协同、预算管理、AI月报、设置）仅列出受影响点。

---

## 0. 现状核查（基于代码实测）
为避免需求与现状脱节，PRD 基于以下实测结论撰写：

| 核查项 | 现状 | 来源 |
| --- | --- | --- |
| 账户模型 | `schema.prisma` 无 Account 模型；`Transaction` 无 `accountId`；后端无 `accounts` 模块（全局搜索 `Account/accounts/accountId` 0 命中） | backend/prisma/schema.prisma、backend/src 全量 grep |
| 分类 API | 后端 `categories` 模块完整：树形 CRUD、初始化国标8大类 + 4类收入（`POST /api/categories/init`） | backend/.../categories/categories.controller.ts |
| 分类前端页 | 无 `/categories` 路由；`App.tsx` 仅 `NotificationsPlaceholder`；`Sidebar` 的 `NAV_ITEMS` 无账户/分类入口 | frontend/src/App.tsx、Sidebar.tsx |
| 交易编辑弹窗 | `EditTransactionModal.tsx` 存在，可编辑金额/日期/类型/分类/商户/备注；缺"账户"字段；分类用前端常量 `DEFAULT_EXPENSE_CATEGORIES` 而非 API | frontend/.../EditTransactionModal.tsx:23,104-185 |
| 清除数据 | `SettingsPage.handleClearAllData` 仅 `// TODO: 接入真实 API` + toast，未删数据；后端无"清空全部交易"接口（仅 `DELETE /api/transactions/:id`） | frontend/.../SettingsPage.tsx:198-202；transactions.controller.ts |
| 深色模式 | 设置页有浅色/深色切换（`useUIStore.theme`），但 `index.css` 仅有 `:root` 亮色变量，**无 `.dark` 覆盖定义** | frontend/src/index.css、SettingsPage.tsx:643-654 |
| 通知中心 | `App.tsx:69` `NotificationsPlaceholder` 为"该页面将在后续迭代中实现"；后端 `notifications` 模块 + `Notification` 模型（7种类型）已就绪但未在前端展示 | frontend/src/App.tsx、schema.prisma:275 |

---

## 1. 产品目标（本次迭代目标）

**一句话目标**：补齐"账户"这一记账核心维度，把分类/交易编辑/数据清除从"假功能"变为"真功能"，并补齐深色模式与通知中心两项体验短板，使家庭财务应用具备完整的记账闭环。

量化目标（建议）：
- 账户模块上线，支持 6 种账户类型 100% 字段覆盖；
- 交易编辑弹窗账户关联率 100%（新建与编辑均必选账户）；
- 分类管理前端页面上线，覆盖一级/二级分类增删改查；
- 设置页"清除数据"按钮真实生效（删除全部交易，保留账户/分类/预算）；
- 深色模式全站可用（覆盖侧边栏、卡片、表单、弹窗、图表底色）；
- 通知中心上线，展示并支持标记已读/全部已读。

**不在本次范围**：账户间自动转账对账、多币种实时汇率、预算按账户维度拆分（列入 P2 / 后续迭代）。

---

## 2. 用户故事（核心场景）

### 2.1 账户管理
- **US-ACC-1**（新建账户）：作为用户，我想添加一张储蓄卡账户，填写机构、卡号后4位、当前余额，以便后续交易归属到该卡。
- **US-ACC-2**（信用卡视图）：作为持卡人，我想维护信用卡的授信额度、账单日、还款日，系统自动算出"可用额度=授信-已用"，让我一眼看清还款压力。
- **US-ACC-3**（多账户总览）：作为家庭财务负责人，我想在"账户"页看到所有账户余额汇总（储蓄+信用卡可用+投资+现金+钱包+虚拟），掌握净资产。
- **US-ACC-4**（账户编辑/停用）：作为用户，我想编辑账户信息或将不再使用的账户"停用"（不删除历史交易）。

### 2.2 分类管理
- **US-CAT-1**（查看体系）：作为用户，我想在分类管理页看到国标 8 大类及其二级分类的树形结构。
- **US-CAT-2**（自定义分类）：作为用户，我想在某大类下新增二级分类（自定义图标/颜色），满足个性化记账。
- **US-CAT-3**（编辑/删除）：作为用户，我想重命名、改色或删除自定义分类；系统分类受保护不可删（仅可隐藏）。

### 2.3 交易编辑
- **US-TXN-1**（编辑关联账户）：作为用户，编辑一笔交易时，必须能选择其所属账户；保存后列表与详情同步。
- **US-TXN-2**（真实分类下拉）：作为用户，交易编辑的分类下拉直接来自后端 API 返回的树形数据，而非前端写死的常量，确保与"分类管理"页一致。
- **US-TXN-3**（新建也选账户）：作为用户，无论是手动记账、Ctrl+K 快捷记账还是导入，都必须指定账户，保证每笔交易有归属。

### 2.4 深色模式
- **US-DARK-1**（一键切换）：作为用户，在设置页点"深色模式"后，全站（含图表、弹窗、表格）立即切换为暗色主题，且不刺眼。
- **US-DARK-2**（记忆偏好）：系统记住我的主题选择，下次打开仍生效。

### 2.5 通知中心
- **US-NOTI-1**（查看通知）：作为用户，点顶栏铃铛进入通知中心，看到按时间倒序的通知列表（预算预警/大额支出/月报生成/成员加入/导入完成等）。
- **US-NOTI-2**（已读管理）：我能单条标记已读，或"全部已读"；未读数在顶栏铃铛上红点提示。
- **US-NOTI-3**（跳转）：点击某条通知可跳转到对应业务页（如预算预警→预算页，月报→月报页）。

---

## 3. 需求池

### 3.1 P0（本次迭代必须交付）

#### P0-1 账户管理模块（后端 + 前端）
| 编号 | 需求 | 说明 / 验收标准 |
| --- | --- | --- |
| P0-1.1 | 数据模型新增 `Account` | schema 新增模型（见 §4.1）；`Transaction` 新增 `accountId`（`String?`，索引） |
| P0-1.2 | 后端 accounts 模块 | CRUD：`GET/POST /api/accounts`、`GET/PATCH/DELETE /api/accounts/:id`、`POST /api/accounts/:id/deactivate`；按 `familyId` 隔离；含余额计算服务 |
| P0-1.3 | 账户列表/总览页 | 前端 `/accounts` 页面，按类型分组卡片展示，顶部显示净资产汇总 |
| P0-1.4 | 新建/编辑账户表单 | 按账户类型动态渲染字段（信用卡显示额度/账单日/还款日；投资/钱包显示平台；虚拟显示用途） |
| P0-1.5 | 侧边栏入口 | `NAV_ITEMS` 增加"账户"（Wallet 图标，置于"交易"附近） |
| P0-1.6 | 存量交易迁移 | 历史交易 `accountId` 为空，提供默认账户回填策略或允许空（见待确认 Q1） |

**6 种账户类型字段矩阵**：

| 类型 | 余额 | 机构 | 卡号后4位 | 授信额度 | 账单日 | 还款日 | 可用额度 | 平台 | 用途 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEBIT 储蓄卡 | ✅ | ✅ | ✅ | — | — | — | — | — | — |
| CREDIT 信用卡 | ✅(欠款) | ✅ | ✅ | ✅ | ✅ | ✅ | 自动=授信-欠款 | — | — |
| INVESTMENT 投资 | ✅ | — | — | — | — | — | — | ✅ | — |
| CASH 现金 | ✅ | — | — | — | — | — | — | — | — |
| E_WALLET 钱包 | ✅ | — | — | — | — | — | — | ✅(支付宝/微信) | — |
| VIRTUAL 虚拟 | ✅ | — | — | — | — | — | — | — | ✅ |

#### P0-2 分类管理前端页面
| 编号 | 需求 | 验收标准 |
| --- | --- | --- |
| P0-2.1 | 新增路由 `/categories` | `App.tsx` 替换占位，懒加载 `CategoryManagePage` |
| P0-2.2 | 树形展示 | 调用 `getCategories(familyId)`，一级（8大类）+ 二级分类树形展示，含图标/颜色 |
| P0-2.3 | 二级分类增删改查 | 复用 `category.service`（create/update/delete），自定义分类可编辑；系统分类（isSystem）不可删 |
| P0-2.4 | 侧边栏入口 | `NAV_ITEMS` 增加"分类"（在"预算"附近） |
| P0-2.5 | 初始化引导 | 新家庭首次进入提示 `POST /api/categories/init` 初始化国标体系 |

#### P0-3 交易编辑弹窗补全
| 编号 | 需求 | 验收标准 |
| --- | --- | --- |
| P0-3.1 | 新增"账户"选择字段 | 弹窗在"类型"后插入账户 `Select`，选项来自 `getAccounts(familyId)`；必填校验 |
| P0-3.2 | 分类改用真实 API 数据 | 移除 `DEFAULT_EXPENSE_CATEGORIES` 常量，改为 `getCategories(familyId)` 树形渲染；`UpdateTransactionRequest` 增加 `accountId` |
| P0-3.3 | 新建/快捷记账同步 | `QuickRecordModal`、新建交易表单同样强制选择账户 |

#### P0-4 清除数据真实生效
| 编号 | 需求 | 验收标准 |
| --- | --- | --- |
| P0-4.1 | 后端清空接口 | 新增 `DELETE /api/transactions/all?familyId=`（或 `POST /api/transactions/clear`），仅删交易，保留账户/分类/预算；需二次确认参数 |
| P0-4.2 | 前端真实调用 | `handleClearAllData` 调用该接口，成功后 toast + 刷新列表；失败给出错误提示 |

#### P0-5 深色模式 CSS
| 编号 | 需求 | 验收标准 |
| --- | --- | --- |
| P0-5.1 | `.dark` 变量覆盖 | 在 `index.css` 增加 `.dark { :root 变量覆写 }`：深色背景/表面/文本/边框 |
| P0-5.2 | 组件适配 | 卡片、表单、弹窗、表格、图表底色随 `.dark` 切换；`tailwind` 暗色类（`dark:`）在必要处补充 |
| P0-5.3 | 全站无遗留亮块 | 走查仪表盘/交易/导入/家庭/预算/月报/设置/通知，无刺眼白块 |

#### P0-6 通知中心页面
| 编号 | 需求 | 验收标准 |
| --- | --- | --- |
| P0-6.1 | 通知列表页 | `App.tsx` 路由指向真实 `NotificationsPage`；调用 `GET /api/notifications`（后端已有） |
| P0-6.2 | 已读交互 | 单条标记已读 + "全部已读"；顶栏铃铛未读数红点来自 `isRead` 统计 |
| P0-6.3 | 类型图标/跳转 | 按 `NotificationType` 配图标与跳转路由（`data` 字段携带跳转参数） |

### 3.2 P1（强烈建议，时间允许纳入）
| 编号 | 需求 | 说明 |
| --- | --- | --- |
| P1-1 | 交易列表/详情展示账户 | 交易列表新增"账户"列/标签；详情显示所属账户 |
| P1-2 | 仪表盘账户维度 | 仪表盘增加"账户构成"卡片（各账户占比/净资产趋势） |
| P1-3 | 余额自动联动 | 新建/编辑/删除交易后，自动重算关联账户 `balance`（需定义记账规则：支出减、收入加；信用卡记欠款） |
| P1-4 | 移动端导航补齐 | `MobileNav` 增加账户/分类入口（当前仅 4 tab） |
| P1-5 | 通知设置联动 | 设置页"通知偏好"开关实际影响后端通知生成/推送 |

### 3.3 P2（后续迭代）
| 编号 | 需求 | 说明 |
| --- | --- | --- |
| P2-1 | 转账交易闭环 | `TRANSFER` 类型选择"从A账户到B账户"，双向调整余额 |
| P2-2 | 账户流水/对账单 | 单账户交易明细与月度对账单导出 |
| P2-3 | 账户归档/回收站 | 停用账户归入归档区，可恢复 |
| P2-4 | 多币种账户 | 结合 `currency` 字段做汇率换算展示 |

---

## 4. UI 设计要点（关键页面布局）

### 4.1 数据模型（建议，供研发参考）
```prisma
enum AccountType {
  DEBIT CREDIT INVESTMENT CASH E_WALLET VIRTUAL
}

model Account {
  id              String      @id @default(uuid())
  familyId        String      @map("family_id")
  ledgerId        String?     @map("ledger_id")   // 归属账本，家庭共同账户可为null
  userId          String      @map("user_id")      // 创建者
  type            AccountType
  name            String
  balance         Decimal     @db.Decimal(12,2)    // 储蓄/投资/现金/钱包/虚拟=余额；信用卡=当前欠款
  institution     String?                         // 机构（储蓄卡/信用卡）
  lastFourDigits  String?     @map("last_four_digits")
  creditLimit     Decimal?    @db.Decimal(12,2)   @map("credit_limit")     // 信用卡
  billingDay      Int?        @map("billing_day") // 1-28
  paymentDueDay   Int?        @map("payment_due_day")
  availableCredit Decimal?    @db.Decimal(12,2)   @map("available_credit") // 自动计算
  platform        String?                         // 投资/钱包平台
  purpose         String?                         // 虚拟账户用途
  currency        String      @default("CNY")
  isActive        Boolean     @default(true)      @map("is_active")
  createdAt       DateTime    @default(now())     @map("created_at")
  updatedAt       DateTime    @updatedAt          @map("updated_at")
  // 关联
  family      Family       @relation(fields:[familyId], references:[id])
  transactions Transaction[]

  @@index([familyId])
  @@map("accounts")
}

// Transaction 新增
model Transaction {
  // ... 现有字段
  accountId  String?  @map("account_id")
  account    Account? @relation(fields:[accountId], references:[id])
  @@index([accountId])
}
```

### 4.2 账户总览页（`/accounts`）
- 顶部：净资产汇总大数字 + "＋ 添加账户"按钮。
- 分组卡片区：按 6 种类型分 Section；每卡片显示名称、机构/平台、余额（信用卡显示"可用额度/授信额度"进度条、账单日/还款日徽标）。
- 卡片 hover 显示"编辑/停用"操作；点击进入编辑抽屉。
- 空状态：引导"添加你的第一个账户"。

### 4.3 新建/编辑账户抽屉
- 字段随"账户类型"单选动态显隐（参考 §3.1 字段矩阵）。
- 信用卡：录入授信额度、账单日、还款日后，实时展示"可用额度 = 授信 − 当前欠款"与"距还款日 N 天"。
- 校验：储蓄卡/信用卡卡号后4位为 4 位数字；余额/额度为非负数。

### 4.4 分类管理页（`/categories`）
- 左：8 大类一级列表（可折叠）；右：选中大类下的二级分类网格（图标+名称+颜色块+编辑/删除）。
- 顶部："初始化国标分类"按钮（未初始化时高亮）；"＋ 新增二级分类"按钮（选图标/颜色）。
- 系统分类显示锁图标，禁用删除；自定义分类可删（删除前若有交易关联，提示先改分类）。

### 4.5 交易编辑弹窗（变更后）
```
金额 → 日期 → 类型 → 【账户 *】（新增 Select） → 分类（改真实API） → 商户 → 备注
```
- 账户为必填，切换类型不清空账户（与分类行为区分）。

### 4.6 深色模式
- `index.css` 增加：
```css
.dark {
  --color-bg: #0F172A;
  --color-surface: #1E293B;
  --color-text-primary: #F1F5F9;
  --color-text-secondary: #94A3B8;
  --color-text-tertiary: #64748B;
  --color-border: #334155;
  --color-primary-light: #064E3B;
}
```
- 触发：设置页切换 `theme` → `document.documentElement.classList.toggle('dark')` → 持久化 localStorage。

### 4.7 通知中心页（`/notifications`）
- 顶部：标题 + "全部已读"按钮 + 未读筛选 Tab（全部/未读）。
- 列表项：左侧类型图标（彩色），中间标题+内容+相对时间，右侧未读圆点；点击整行标记已读并跳转 `data` 指定路由。
- 空状态："暂无通知"。

---

## 5. 待确认问题（需团队/业务决策）

1. **Q1 存量交易账户归属**：历史交易无 `accountId`。方案 A——上线时强制用户先建"默认账户"并批量回填；方案 B——允许 `accountId` 为空，列表以"未分类账户"展示，后续逐步补全。需确认选哪种（影响 P0-1.6 与数据迁移脚本）。
2. **Q2 余额联动口径**：交易保存后是否自动改写账户 `balance`？信用卡"支出"是增加欠款还是减少可用额度？需与财务逻辑确认（影响 P1-3 是否本期做）。
3. **Q3 清除数据范围**：`handleClearAllData` 当前文案"保留账户和设置"，但 `deleteAccount` 另有一条"删除账户"危险操作——本期只做"清空交易"，还是一并做实"删除账户"？建议本期仅清空交易。
4. **Q4 账户与账本关系**：账户是否绑定到具体 `Ledger`（个人/共同）？家庭共同账户如何多人可见可记？需确认 `ledgerId` 是否必填。
5. **Q5 通知触发源**：后端 `Notification` 模型与 7 种 `NotificationType` 已存在，但现有代码是否已在各业务节点生成通知？若未生成，通知中心上线初期可能为空，需确认是否本迭代补齐"通知生成"逻辑（建议至少补齐大额支出/预算预警/月报三类触发）。
6. **Q6 移动端优先级**：`MobileNav` 当前 4 tab，账户/分类入口放不下。是否本期扩展为 5 tab 或收入"更多"菜单？

---

## 6. 验收清单（Definition of Done）
- [ ] `Account` 模型上线并 `prisma migrate` 通过，存量数据可按 Q1 方案处理；
- [ ] 前端 `/accounts`、新增/编辑账户可用，6 类账户字段正确；
- [ ] 前端 `/categories` 可用，二级分类增删改查生效，系统分类受保护；
- [ ] 交易编辑/新建/快捷记账均强制选账户，分类下拉来自真实 API；
- [ ] 设置页"清除数据"真实删除全部交易并刷新；
- [ ] 深色模式全站点亮无刺眼白块，偏好持久化；
- [ ] 通知中心展示列表、已读/全部已读、红点未读、点击跳转；
- [ ] 上述 6 项 P0 在 `https://family-finance.cloud/` 验证通过。

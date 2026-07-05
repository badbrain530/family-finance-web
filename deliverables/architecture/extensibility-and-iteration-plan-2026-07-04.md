# 架构扩展性评估与迭代规划

**日期**：2026-07-04
**架构师**：高见远（Gao）
**基于**：系统架构设计文档 `architecture-design-web-2026-07-04.md`
**状态**：已完成
**定位**：主架构文档的补充，聚焦扩展性评估、扩展点设计、月度迭代节奏、技术债务预防

---

## 目录

1. [架构扩展性评估](#1-架构扩展性评估)
2. [扩展点设计建议](#2-扩展点设计建议)
3. [月度迭代规划（12个月）](#3-月度迭代规划12个月)
4. [技术债务预防策略](#4-技术债务预防策略)

---

## 1. 架构扩展性评估

对6个扩展方向逐一分析当前架构的支撑能力，评级标准：
- ✅ **已有支持**：当前架构设计已预留，可直接实现
- 🔧 **需小幅调整**：调整数据模型字段或新增模块，1-2周可完成
- 🏗️ **需较大改造**：涉及核心模型变更或架构模式调整，3周以上

### 1.1 报表系统扩展（自定义报表引擎、多维度分析、报表模板）

**评级**：🔧 需小幅调整

**当前架构基础**：
- `MonthlyReport` 模型已使用 JSONB 字段存储 `categoryBreakdown`、`anomalies`、`advice`，天然支持灵活数据结构
- `reports.service.ts` 负责报告生成编排，`statistics.service.ts` 独立负责统计分析，职责分离清晰
- `dashboard.service.ts` 已实现多表聚合查询，可作为自定义报表的数据源
- 前端 `features/report/` 目录按章节组件拆分（OverviewSection、SpendingAnalysisSection等），扩展新报表类型只需新增章节组件

**已预留的扩展点**：
- JSONB 字段设计让报表内容结构可自由演化，无需改表
- `statistics.service.ts` 的统计方法可被新报表类型复用
- ECharts 5 图表库支持所有常见报表可视化类型

**需要做的调整**：

| 调整项 | 说明 | 工作量 |
|--------|------|--------|
| 抽象报表模板系统 | 新建 `ReportTemplate` 模型，定义报表类型（月报/年报/季报/自定义）、数据源、章节配置；当前 `MonthlyReport` 改为 `ReportTemplate` 的一个实例 | 1周 |
| 报表引擎服务 | 新建 `report-engine.service.ts`，根据模板配置动态组装章节，调用 `statistics.service.ts` 获取数据，生成结构化报表 | 1周 |
| 时间维度扩展 | 当前 `Budget` 仅支持 `monthly` 周期，报表需支持 `weekly/quarterly/yearly/custom`；需扩展日期范围查询逻辑 | 3天 |
| 自定义维度分析 | 新建 `dimension` 概念（按成员/按账本/按分类/按商户/自定义标签），`statistics.service.ts` 增加 `groupBy` 参数 | 3天 |
| 前端报表构建器 | 新增可视化报表构建器页面，用户拖拽维度+指标生成自定义报表 | 1周 |

**建议**：MVP阶段将 `MonthlyReport` 重构为更通用的 `Report` 模型，增加 `templateType` 和 `config` (JSONB) 字段，避免后期数据迁移。

---

### 1.2 投资组合模块（资产类型管理、持仓跟踪、收益率计算、市场数据接入）

**评级**：🏗️ 需较大改造（新功能模块，但架构模式可复用）

**当前架构基础**：
- `TransactionType` 枚举已预留 `TRANSFER` 类型，可扩展为 `INVESTMENT_BUY`/`INVESTMENT_SELL`
- NestJS 模块化架构，新增 `investments` 模块对现有模块零侵入
- `llm.provider.ts` 的外部服务封装模式可直接复制用于市场数据API接入
- 前端 `features/` 目录按功能模块组织，新增 `features/investment/` 即可
- ECharts 5 支持 K线图、收益率曲线等金融图表
- 家庭账本体系（`Family` → `Ledger` → `Transaction`）天然支持"家庭投资组合"概念

**已预留的扩展点**：
- `Category` 模型可新增投资分类（股票/基金/理财/债券），无需改模型
- `Ledger` 模型可新增 `type: 'investment'`，投资账本与消费账本隔离
- AI模块的 `llm.provider.ts` 展示了外部API集成模式，市场数据接入可复用此模式

**需要做的改造**：

| 改造项 | 说明 | 工作量 |
|--------|------|--------|
| 新增投资数据模型 | `InvestmentAccount`（投资账户）、`Holding`（持仓）、`AssetPrice`（资产价格快照）、`InvestmentTransaction`（买卖记录）| 1周 |
| 市场数据接入服务 | 新建 `market-data.provider.ts`，接入行情API（如新浪财经/东方财富/阿里云金融数据）；设计 `IMarketDataProvider` 接口支持多数据源 | 1周 |
| 收益率计算引擎 | 新建 `performance.service.ts`，计算持有收益率、年化收益率、IRR；支持按持仓/按账户/按家庭聚合 | 1.5周 |
| 投资组合仪表盘 | 新增投资概览页面：总资产、资产配置饼图、收益率趋势、持仓明细表 | 1周 |
| 资产净值同步定时任务 | 每日收盘后定时拉取最新行情，更新持仓估值；新增 `price-sync.task.ts` | 3天 |
| 交易关联 | 投资买卖记录与 `Transaction` 关联（资金从消费账本转入投资账本），复用 `TransactionType.TRANSFER` | 3天 |

**架构融入方式**：
```
新增模块路径：
  server/src/modules/investments/
    ├── investments.module.ts
    ├── investments.controller.ts       # 持仓CRUD + 组合查询
    ├── investments.service.ts          # 持仓管理逻辑
    ├── performance.service.ts          # 收益率计算引擎
    ├── market-data.provider.ts         # 行情API封装
    └── dto/

  client/src/features/investment/
    ├── PortfolioPage.tsx               # 投资组合总览
    ├── HoldingsTable.tsx               # 持仓明细表
    ├── AssetAllocationChart.tsx        # 资产配置饼图
    ├── PerformanceChart.tsx            # 收益率曲线
    └── AddHoldingDialog.tsx            # 新增持仓
```

**关键设计决策**：投资模块作为独立模块接入，通过 `Transaction` 的 `TRANSFER` 类型与消费账本建立资金流向关联，避免侵入现有交易模型。

---

### 1.3 多币种支持

**评级**：🔧 需小幅调整

**当前架构基础**：
- 主架构文档 8.3 节已明确预留："`Transaction` 模型可扩展 `currency` 字段"
- PostgreSQL 的 `decimal` 类型精度足够处理汇率计算
- Prisma 5 支持通过 Migration 新增字段，不影响现有数据

**已预留的扩展点**：
- `Transaction.amount` 为独立数值字段，增加 `currency` 字段不破坏现有逻辑
- `Budget.amount` 同样可增加 `currency` 支持
- 前端 `AmountText` 组件集中处理金额展示，增加币种符号显示即可全局生效

**需要做的调整**：

| 调整项 | 说明 | 工作量 |
|--------|------|--------|
| Transaction 增加 currency 字段 | 新增 `currency: string`（默认 `CNY`），Migration 自动给现有数据填充 `CNY` | 2天 |
| Family 增加 baseCurrency | 家庭本位币设置，默认 `CNY`；所有统计聚合按本位币折算 | 1天 |
| 汇率服务 | 新建 `exchange-rate.service.ts`，接入汇率API（如阿里云汇率/exchangerate-api）；每日缓存汇率到 Redis | 2天 |
| 金额展示组件升级 | `AmountText` 组件增加 `currency` prop，根据币种显示符号；聚合数据按本位币显示并标注"含外币折算" | 2天 |
| 统计聚合逻辑 | `statistics.service.ts` 和 `dashboard.service.ts` 的聚合查询增加汇率折算逻辑 | 3天 |
| 账单导入汇率处理 | 导入含外币交易时，按交易日期查找历史汇率自动折算 | 2天 |

**建议**：MVP阶段即在 `Transaction` 模型中增加 `currency String @default("CNY")` 字段，成本极低但避免后期ALTER TABLE大表的风险。

---

### 1.4 税务计算模块

**评级**：🏗️ 需较大改造（全新功能域，但可复用现有数据）

**当前架构基础**：
- `Transaction` 和 `Category` 数据可作为税务计算的数据源
- AI模块的 LLM 接入路径可用于"税务优化建议"
- `MonthlyReport` 的 `AdviceItem` 机制可承载税务建议

**已预留的扩展点**：
- `Category` 模型有 `isSystem` 标记，可标记税务相关分类
- `AdviceItem.actionType` 可扩展 `tax_optimize` 类型
- AI模块 `llm.provider.ts` 可复用于税务政策问答

**需要做的改造**：

| 改造项 | 说明 | 工作量 |
|--------|------|--------|
| 税务规则模型 | `TaxRule`（税率表/起征点/专项附加扣除）、`TaxRecord`（年度税务记录）| 1周 |
| 个税计算引擎 | 新建 `tax.service.ts`，实现中国个人所得税累计预扣法计算；支持专项附加扣除配置 | 1.5周 |
| 税务数据采集 | 从交易数据中识别应税收入（工资/劳务报酬/稿酬）；关联分类标记 | 1周 |
| 年度税务报告 | 新增年度税务报告类型，汇总应税收入、已缴税款、汇算清缴建议 | 1周 |
| AI税务优化建议 | 扩展 `insight.service.ts`，结合税务规则和用户数据生成节税建议 | 1周 |

**风险评估**：中国税法复杂且年度更新，建议与税务专业顾问合作设计规则，MVP后再启动此模块。

---

### 1.5 负债/贷款管理

**评级**：🔧 需小幅调整

**当前架构基础**：
- `TransactionType.TRANSFER` 已预留，可用于贷款还款记录
- `WishGoal` 模型（目标金额/当前金额/完成状态）可被复用为"还贷目标"
- `Budget` 模型可追踪月度还款额
- `Category` 可新增"还贷"分类

**已预留的扩展点**：
- `Transaction.source` 枚举可扩展 `LOAN_REPAYMENT`
- `NotificationType` 可扩展 `LOAN_DUE_REMINDER`
- 预算预警机制可复用于还款提醒

**需要做的调整**：

| 调整项 | 说明 | 工作量 |
|--------|------|--------|
| Loan 模型 | 新增 `Loan` 实体：本金、利率、期限、还款方式（等额本息/等额本金）、月供、起止日期 | 3天 |
| 还款计划生成 | `amortization.service.ts`：根据贷款参数生成完整还款计划表（本金/利息分解） | 3天 |
| 负债仪表盘 | 新增负债概览组件：总负债、月供占比、剩余期数、还清进度 | 3天 |
| 自动记账关联 | 每月还款日自动生成还款交易记录，关联 `Loan` 和 `Transaction` | 2天 |
| 还款提醒 | 复用通知系统，提前3天推送还款提醒 | 1天 |

**建议**：`Loan` 模型设计时增加 `type` 枚举字段（`mortgage`/`car_loan`/`consumer_loan`/`credit_card`），为后续不同类型贷款的差异化展示预留。

---

### 1.6 第三方数据源接入（股票行情、汇率、银行API开放平台）

**评级**：✅ 已有支持（架构模式已建立）

**当前架构基础**：
- `llm.provider.ts` 已建立了"外部服务 Provider 封装"模式：接口抽象 + 配置注入 + 错误降级
- `parser.factory.ts` + `IBillParser` 接口已建立了"策略模式 + 工厂模式"的数据源适配架构
- `ali-oss` 的集成展示了第三方云服务接入的标准方式
- NestJS 的依赖注入机制使得新增 Provider 只需注册 Module

**已预留的扩展点**：
- `imports/parsers/` 目录下每个 Parser 独立，新增银行API直连 Parser 只需实现 `IBillParser` 接口
- `config/` 目录的配置模块模式可复用于任何第三方服务配置
- Redis 缓存层已就绪，可用于缓存行情/汇率数据

**接入路径**：

```
新建外部数据 Provider 层：
  server/src/modules/external-providers/
    ├── market-data/
    │   ├── market-data.interface.ts       # IMarketDataProvider 接口
    │   ├── sina-finance.provider.ts        # 新浪财经行情
    │   ├── eastmoney.provider.ts           # 东方财富行情
    │   └── market-data.factory.ts          # 多源切换工厂
    ├── exchange-rate/
    │   ├── exchange-rate.interface.ts      # IExchangeRateProvider 接口
    │   ├── aliyun-rate.provider.ts         # 阿里云汇率API
    │   └── exchange-rate.factory.ts
    └── bank-api/
        ├── bank-api.interface.ts           # IBankApiProvider 接口
        └── (各家银行API适配器)

统一配置入口（复用 config 模块模式）：
  server/src/config/external-api.config.ts
```

**需要做的调整**：仅新增代码，不修改现有模块，零侵入。

---

### 1.7 扩展性评估总览

| 扩展方向 | 评级 | 核心依赖 | 预计总工作量 | 建议启动时机 |
|----------|------|----------|-------------|-------------|
| 报表系统扩展 | 🔧 小幅调整 | reports 模块 | 3-4周 | 第3月（功能迭代月） |
| 投资组合模块 | 🏗️ 较大改造 | 新建 investments 模块 | 5-6周 | 第7月（功能迭代月） |
| 多币种支持 | 🔧 小幅调整 | Transaction + 统计层 | 2周 | 第11月（或更早按需） |
| 税务计算模块 | 🏗️ 较大改造 | 新建 tax 模块 | 5-6周 | 第9月后（需税务顾问配合） |
| 负债/贷款管理 | 🔧 小幅调整 | 新建 Loan 模型 | 2-3周 | 第5月（功能迭代月） |
| 第三方数据源 | ✅ 已有支持 | 新建 providers 层 | 按需 | 按各模块需求同步建设 |

---

## 2. 扩展点设计建议

### 2.1 数据模型层面

#### 2.1.1 JSONB 字段策略

当前已使用 JSONB 的模型：`MonthlyReport`（categoryBreakdown/anomalies/advice）、`Notification`（data）。

**建议扩展**：

| 模型 | 新增 JSONB 字段 | 用途 | 理由 |
|------|----------------|------|------|
| `Transaction` | `metadata` | 存储扩展属性（如投资关联ID、外币原始金额、税务标记、贷款关联ID） | 避免频繁ALTER TABLE新增字段；JSONB索引支持查询 |
| `Family` | `settings` | 家庭级配置（大额支出阈值、默认币种、报表偏好等） | 家庭设置项会持续增加，JSONB比频繁加字段灵活 |
| `Category` | `rules` | 分类自动匹配规则（关键词/金额范围/商户正则） | 支持用户自定义分类规则，增强AI分类能力 |
| `User` | `preferences` | 用户偏好（主题/语言/通知偏好/快捷键自定义） | 个性化设置项持续增加 |

#### 2.1.2 MVP阶段应立即做的模型预留

以下字段成本极低（Prisma schema 加一行 + Migration），但能避免后期大表ALTER TABLE的痛苦：

```prisma
// Transaction 模型新增
model Transaction {
  // ... 现有字段 ...
  currency    String    @default("CNY")  // 多币种预留
  metadata    Json?                       // 扩展属性预留
  tags        String[]  @default([])      // 自定义标签预留（多维分析）
}

// Family 模型新增
model Family {
  // ... 现有字段 ...
  baseCurrency String    @default("CNY")  // 家庭本位币
  settings     Json?                       // 家庭配置
}

// Category 模型新增
model Category {
  // ... 现有字段 ...
  rules        Json?                       // 自动匹配规则
}
```

#### 2.1.3 避免使用EAV模式

PostgreSQL 的 JSONB 已能覆盖绝大部分灵活属性需求。EAV（Entity-Attribute-Value）模式在关系型数据库中查询复杂、性能差，不推荐使用。仅在以下场景考虑：
- 用户自定义字段（如投资属性：股票代码/基金类型/期限等）→ 用 JSONB `metadata` 即可
- 如果未来出现"字段本身需要查询和聚合"的需求（如按自定义标签统计），再考虑独立关联表

### 2.2 模块化层面

#### 2.2.1 NestJS 模块隔离原则

当前架构的 NestJS 模块划分已经为扩展建立了良好基础。新功能模块接入遵循以下原则：

```
原则1：新功能 = 新模块
  - 投资组合 → server/src/modules/investments/
  - 税务计算 → server/src/modules/tax/
  - 负债管理 → server/src/modules/loans/
  每个模块自包含 module/controller/service/dto，通过 imports 声明依赖

原则2：跨模块通信用事件，不直接调用
  - 使用 NestJS EventEmitter2 (@nestjs/event-emitter)
  - 例：交易创建 → emit('transaction.created') → 预算模块监听更新进度 → 通知模块监听触发预警
  - 当前 WebSocket 广播已实现此模式，推广到所有跨模块场景

原则3：共享逻辑下沉到 common/
  - 日期处理、金额格式化、统计聚合等通用逻辑放在 common/ 或 utils/
  - 避免模块间直接 import 对方的 service
```

#### 2.2.2 事件驱动通信架构

**MVP阶段建议引入** `@nestjs/event-emitter`，建立事件总线：

```typescript
// 事件定义示例
// server/src/common/events/transaction.events.ts
export class TransactionCreatedEvent {
  transaction: Transaction;
  userId: string;
  familyId: string;
}

// 发布事件（transactions.service.ts）
this.eventEmitter.emit('transaction.created', new TransactionCreatedEvent(...));

// 监听事件（budgets.service.ts）
@OnEvent('transaction.created')
handleTransactionCreated(event: TransactionCreatedEvent) {
  // 更新预算执行进度
}

// 监听事件（notifications.service.ts）
@OnEvent('transaction.created')
handleTransactionCreated(event: TransactionCreatedEvent) {
  // 检查大额支出 → 发送通知
}

// 监听事件（websocket.service.ts）
@OnEvent('transaction.created')
handleTransactionCreated(event: TransactionCreatedEvent) {
  // WebSocket 广播给家庭在线成员
}
```

**收益**：当前架构中 `transactions.service.ts` 直接调用 `websocket.service.ts` 和 `notifications.service.ts`，引入事件总线后，新增的预算、税务、投资模块只需监听事件即可，无需修改交易模块代码。

#### 2.2.3 前端模块化扩展

前端 `features/` 目录已按功能模块组织。新功能扩展遵循：

```
新增功能 = 新增 features/xxx/ 目录 + 路由配置 + 侧边栏入口

扩展步骤：
1. client/src/features/investment/         # 新建功能目录
2. client/src/routes/index.tsx             # 新增路由（懒加载）
3. client/src/components/layout/Sidebar.tsx # 新增导航入口
4. client/src/services/investment.service.ts # 新增API服务
5. client/src/types/investment.ts           # 新增类型定义
```

无需修改现有功能模块代码，零侵入。

### 2.3 API层面

#### 2.3.1 API版本管理策略

**MVP阶段**：使用 `/api/` 前缀（隐含 v1），不显式版本号。

**扩展阶段**：当出现破坏性变更时，引入显式版本号：

```
当前：  /api/transactions          → v1（隐含）
扩展后：/api/v1/transactions        → v1（显式，向后兼容）
       /api/v2/transactions        → v2（破坏性变更）
```

**版本切换策略**：
- v1 和 v2 并行运行至少6个月
- v1 标记 `@Deprecated`，响应头增加 `Sunset` 头告知废弃时间
- 前端通过 `api.ts` 的 baseURL 统一控制版本，切换成本极低
- 不建议在MVP阶段就加 `/v1/`，因为短期内不会出v2，过早加版本号增加URL复杂度

#### 2.3.2 功能开关（Feature Flags）

**建议MVP阶段引入**轻量级功能开关机制：

```typescript
// server/src/config/feature-flags.ts
// 使用 Redis 存储开关状态，支持运行时动态切换
@Injectable()
export class FeatureFlagsService {
  async isEnabled(feature: string): Promise<boolean> {
    const value = await this.redis.get(`feature:${feature}`);
    return value === 'true';
  }
}

// 使用示例
@ifFeatureEnabled('investment')
@Controller('investments')
export class InvestmentsController { ... }
```

**收益**：新功能开发完成后可通过开关灰度发布，降低部署风险；A/B测试不同功能组合；付费功能按订阅状态动态启用。

### 2.4 AI能力层面

#### 2.4.1 LLM Provider 抽象层

当前 `llm.provider.ts` 已封装通义千问API。**建议立即抽象为接口**，支持多LLM切换：

```typescript
// server/src/modules/ai/llm.provider.interface.ts
export interface ILLMProvider {
  chat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse>;
  functionCall(prompt: string, functions: FunctionDef[]): Promise<FunctionCallResult>;
  embedding(text: string): Promise<number[]>;  // 为RAG预留
}

// 实现
export class QianwenProvider implements ILLMProvider { ... }  // 通义千问（当前）
export class WenxinProvider implements ILLMProvider { ... }    // 文心一言（备用）
export class DeepseekProvider implements ILLMProvider { ... }  // DeepSeek（成本优化）
```

**收益**：LLM服务降级（通义千问不可用时自动切换）、成本优化（简单任务用更便宜的模型）、A/B测试不同模型效果。

#### 2.4.2 后续AI功能接入路径

| AI功能 | 接入路径 | 复用的现有组件 | 新增组件 |
|--------|----------|--------------|---------|
| 智能投顾 | AI模块新增 `investment-advisor.service.ts` | `llm.provider` + 投资模块数据 | RAG知识库（基金/股票基础知识） |
| 税务优化建议 | AI模块新增 `tax-advisor.service.ts` | `llm.provider` + 税务模块数据 | 税法知识库 |
| 消费预测 | AI模块新增 `forecast.service.ts` | `statistics.service` + 历史数据 | 时间序列预测模型 |
| 智能分账建议 | AI模块新增 `split-advisor.service.ts` | `llm.provider` + 家庭交易数据 | 分账规则引擎 |
| AI对话顾问 | AI模块新增 `chat.service.ts` | `llm.provider` + RAG | 向量数据库（pgvector）+ 对话历史管理 |

#### 2.4.3 RAG（检索增强生成）架构预留

AI对话顾问（P2-05）需要RAG架构，**建议在MVP阶段做以下预留**：

1. **PostgreSQL pgvector 扩展**：MVP阶段安装 pgvector 扩展（零成本），为后续向量检索预留
2. **LLM Provider 增加 embedding 方法**：接口预留文本向量化能力
3. **知识库表预留**：`KnowledgeBase` 模型（id, content, embedding vector, metadata）可在需要时创建

```sql
-- MVP阶段执行（一次性，零风险）
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## 3. 月度迭代规划（12个月）

### 3.1 规划原则

1. **交替节奏**：奇数月为功能迭代，偶数月为稳定性/性能优化
2. **每月一个核心主题**：避免并行太多方向导致进度不可控
3. **工作量基准**：7人团队（前端2+后端2+AI1+设计1+测试1），每月20个工作日
4. **假设MVP在第0月完成**（对应PRD的Week 15），迭代从第1月开始
5. **P1/P2需求优先于全新方向**：先消化PRD已定义需求，再启动新方向

### 3.2 迭代总览

| 月份 | 类型 | 核心主题 | 主要交付 |
|------|------|---------|---------|
| M1 | 🔵 功能 | OCR票据 + 消费画像 | P1-01, P1-02 |
| M2 | 🟢 稳定 | 性能优化 + 测试覆盖 | 查询优化、E2E测试、监控完善 |
| M3 | 🔵 功能 | 健康度评分 + 个性化建议 | P1-03, P1-04 |
| M4 | 🟢 稳定 | 安全加固 + 合规 | 等保自查、渗透测试、数据加密审计 |
| M5 | 🔵 功能 | 信用卡导入 + 负债管理 | P1-05, P1-06, P1-07, 负债模块 |
| M6 | 🟢 稳定 | 数据库优化 + 缓存策略 | 索引优化、读写分离评估、Redis优化 |
| M7 | 🔵 功能 | 投资组合 v1 | 持仓管理 + 行情接入 + 收益率 |
| M8 | 🟢 稳定 | 技术债务清理 + 重构 | 事件总线、Provider抽象、代码质量 |
| M9 | 🔵 功能 | AI对话顾问 + 预测分析 | P2-05, P2-01 |
| M10 | 🟢 稳定 | 扩展性准备 + 压测 | 水平扩展验证、负载测试、限流升级 |
| M11 | 🔵 功能 | 分账建议 + 年报 + 多币种 | P2-03, P2-07, 多币种 |
| M12 | 🟢 稳定 | 年度收尾 + 生产加固 | 灾备、文档、SLA、年度复盘 |

### 3.3 各月详细规划

---

#### M1（功能迭代）：OCR票据识别 + 消费行为画像

| 项 | 内容 |
|----|------|
| **目标** | 补齐P1前两项高价值功能，增强记账便捷性和数据深度 |
| **交付功能** | |
| P1-01 OCR票据扫描 | 拍照/上传票据 → 阿里云OCR识别 → 自动提取金额/日期/商户 → 生成交易记录 |
| P1-02 消费行为画像 | 基于累计3个月数据，生成消费偏好/高频场景/情绪消费占比分析报告 |
| **涉及模块** | `imports`（新增receipt.parser.ts）、`ai`（新增profile.service.ts）、`reports`（新增画像报告类型）、前端 `features/import/` + `features/profile/`（新增） |
| **新增依赖** | 阿里云OCR SDK（@alicloud/ocr-api） |
| **工作量** | 前端2人×3周 + 后端1人×3周 + AI1人×2周 + 测试1人×1周 |
| **验收标准** | OCR准确率≥95%/耗时<3秒；画像准确度用户认可率≥70% |

---

#### M2（稳定性迭代）：性能优化 + 测试覆盖

| 项 | 内容 |
|----|------|
| **目标** | 为MVP上线后的数据增长做性能准备，建立自动化测试防线 |
| **优化项** | |
| 数据库查询优化 | 慢查询排查（pg_stat_statements）；交易列表分页查询索引优化；Dashboard聚合查询物化视图 |
| 前端性能 | 交易列表虚拟滚动验证（万条数据）；ECharts大数据量渲染优化；路由懒加载覆盖率检查 |
| API缓存策略 | Redis缓存层完善：Dashboard数据缓存（5分钟TTL）、分类树缓存、在线状态查询优化 |
| E2E测试 | Playwright端到端测试覆盖核心流程（注册→创建家庭→记账→导入→月报）；CI集成 |
| 单元测试 | 后端核心Service单元测试覆盖率目标≥70%；前端关键Hooks测试 |
| 监控完善 | ARMS自定义大盘（API响应时间/P95、WebSocket连接数、数据库连接池）；Sentry前端错误聚合 |
| **涉及模块** | 全局（无新功能） |
| **工作量** | 后端2人×3周 + 前端1人×2周 + 测试1人×3周 |

---

#### M3（功能迭代）：家庭财务健康度评分 + 个性化省钱建议

| 项 | 内容 |
|----|------|
| **目标** | 从"记录"升级到"评估"，建立财务健康度量化体系 |
| **交付功能** | |
| P1-03 家庭财务健康度评分 | 0-100分综合评分 + 分项评分（储蓄率/负债比/支出结构/应急储备/目标达成）+ 改善建议 |
| P1-04 个性化省钱/理财建议 | AI识别优化空间 → 输出可执行建议 → 建议跟踪（采纳/忽略）→ 效果回溯 |
| **涉及模块** | `ai`（新增health-score.service.ts + advice.service.ts）、`reports`、`dashboard`（新增评分卡片）、前端 `features/health-score/` + `features/advice/` |
| **工作量** | 后端1.5人×3周 + AI1人×3周 + 前端2人×3周 + 设计1人×1周 |
| **验收标准** | 评分逻辑可解释；建议可执行性用户认可率≥60% |

---

#### M4（稳定性迭代）：安全加固 + 合规准备

| 项 | 内容 |
|----|------|
| **目标** | 为商业化付费上线做安全准备，满足中国数据合规要求 |
| **优化项** | |
| 等保二级自查 | 对照等保二级要求逐项检查：访问控制、安全审计、入侵防范、数据完整性/保密性 |
| 渗透测试 | 聘请第三方安全团队进行Web应用渗透测试；修复OWASP Top 10漏洞 |
| 数据加密审计 | 验证AES-256存储加密覆盖范围（手机号/邮箱/交易备注等敏感字段）；密钥轮换机制 |
| API安全 | JWT Token安全策略审查；Refresh Token轮换（检测重放攻击）；CORS严格化 |
| 日志审计 | 操作日志完善（谁在何时做了什么）；敏感操作审计日志（删除交易/修改权限等） |
| 隐私合规 | 隐私政策更新；用户数据导出/删除接口（GDPR/PIPL合规预留） |
| **涉及模块** | `common/guards`、`common/filters`、`utils/crypto.util.ts`、`auth` |
| **工作量** | 后端2人×3周 + 测试1人×2周 + 外部安全团队1周 |

---

#### M5（功能迭代）：信用卡导入 + 账单同步 + 负债管理

| 项 | 内容 |
|----|------|
| **目标** | 扩展数据来源覆盖面，启动负债管理新方向 |
| **交付功能** | |
| P1-05 信用卡账单导入 | 支持主流银行信用卡账单PDF/CSV解析（账单金额/最低还款/还款日/交易明细） |
| P1-06 账单同步状态追踪 | 同步中心页面：各平台最近同步时间/记录数/异常状态/手动重新同步 |
| P1-07 分类体系自定义 | 家庭管理员创建自定义分类 → 同步至所有成员；分类拖拽排序 |
| 负债管理模块（新方向） | Loan模型 + 还款计划生成 + 负债仪表盘 + 自动还款记账 + 还款提醒 |
| **涉及模块** | `imports`（新增信用卡Parser）、`categories`（自定义分类）、新建 `loans` 模块、前端 `features/sync-center/` + `features/loans/` |
| **工作量** | 后端2人×4周 + 前端2人×4周（本月任务较重，可考虑将P1-07延至M6后） |
| **验收标准** | 信用卡解析准确率≥90%；负债模块可用且数据准确 |

---

#### M6（稳定性迭代）：数据库优化 + 缓存策略

| 项 | 内容 |
|----|------|
| **目标** | 应对数据量增长（预计6个月后交易量10万+），提前优化数据层 |
| **优化项** | |
| 索引优化 | 根据实际查询模式调整索引：交易表复合索引（familyId+date+categoryId）、分类树查询优化 |
| 分区策略评估 | 交易表按月分区可行性评估（PostgreSQL原生分区）；如数据量<50万暂不实施但出方案 |
| 读写分离评估 | 评估是否需要只读副本（当前单实例够用，但出扩容方案文档） |
| Redis优化 | 缓存键命名规范清理；过期策略审查；内存使用分析；连接池配置优化 |
| 数据归档 | 超过2年的交易数据归档策略（冷数据移至归档表，减少主表体积） |
| 查询超时保护 | 所有数据库查询增加超时限制（默认5秒），防止慢查询拖垮连接池 |
| **涉及模块** | `prisma/`（Migration/索引）、`config/` |
| **工作量** | 后端2人×3周 + 运维1人×1周 |

---

#### M7（功能迭代）：投资组合 v1

| 项 | 内容 |
|----|------|
| **目标** | 启动全新投资管理方向，扩展产品从"记账"到"管财"的边界 |
| **交付功能** | |
| 投资账户管理 | 创建投资账户（股票/基金/理财/债券），关联家庭账本 |
| 持仓管理 | 手动录入持仓（资产代码/名称/数量/成本价），支持增删改查 |
| 行情数据接入 | 接入新浪财经/东方财富API，每日收盘自动更新估值 |
| 收益率计算 | 持有收益率、年化收益率、IRR计算；按持仓/账户/家庭聚合展示 |
| 投资组合仪表盘 | 总资产概览、资产配置饼图、收益率趋势曲线、持仓明细表 |
| 资金流转关联 | 投资买入/卖出生成 `TransactionType.TRANSFER` 记录，资金从消费账本转入投资账本 |
| **涉及模块** | 新建 `investments` 模块（全套）、前端新建 `features/investment/`、`external-providers/market-data/` |
| **新增依赖** | 无新增（行情API通过axios调用） |
| **工作量** | 后端2人×4周 + 前端2人×4周 + AI1人×1周（行情数据清洗） |
| **验收标准** | 持仓数据准确；收益率计算误差<0.1%；行情更新延迟<1小时 |

---

#### M8（稳定性迭代）：技术债务清理 + 架构重构

| 项 | 内容 |
|----|------|
| **目标** | 在投资模块上线后进行架构升级，为后续AI密集功能做技术准备 |
| **优化项** | |
| 事件总线引入 | 引入 `@nestjs/event-emitter`，将交易模块与其他模块的直接调用改为事件驱动；梳理所有跨模块调用点 |
| LLM Provider 抽象 | 将 `llm.provider.ts` 抽象为 `ILLMProvider` 接口；新增 DeepSeek 作为低成本备选 |
| 功能开关机制 | 实现 `FeatureFlagsService`（Redis驱动），为投资模块灰度发布和付费功能控制做准备 |
| API版本化准备 | 评估是否需要引入 `/api/v1/` 前缀；如果需要则统一迁移 |
| 代码质量 | ESLint规则收紧（禁止any、强制返回类型）；圈复杂度检查；重复代码检测 |
| 前端重构 | 组件提取审查（消除>300行的大组件）；TanStack Query 缓存键规范化；状态管理边界梳理 |
| TypeScript严格化 | `strict: true` 全量开启；消除所有 `any` 和 `@ts-ignore` |
| **涉及模块** | 全局重构（不新增功能） |
| **工作量** | 后端2人×3周 + 前端2人×3周 |

---

#### M9（功能迭代）：AI对话顾问 + 预测分析

| 项 | 内容 |
|----|------|
| **目标** | 上线高阶AI功能，提升付费转化（对应PRD Phase 4B/M6里程碑） |
| **交付功能** | |
| P2-05 AI对话式财务顾问 | 用户自然语言提问 → AI基于用户真实数据分析 → 返回具体数字+建议；支持多轮对话 |
| P2-01 教育/医疗支出预测 | 基于6个月+历史数据，输出未来3-6个月预测区间（含置信度）；预测误差<20% |
| RAG知识库 | pgvector向量检索；构建家庭财务基础知识库（理财常识/税务政策/保险知识） |
| **涉及模块** | `ai`（新增chat.service.ts + forecast.service.ts + rag.service.ts）、新建 `knowledge` 模块、前端 `features/ai-chat/` |
| **新增依赖** | pgvector（PostgreSQL扩展）、可能的向量embedding API |
| **工作量** | AI1人×4周 + 后端1人×4周 + 前端1.5人×4周 |
| **验收标准** | AI回答基于真实数据准确率≥85%；预测误差<20% |

---

#### M10（稳定性迭代）：扩展性准备 + 压力测试

| 项 | 内容 |
|----|------|
| **目标** | 验证架构水平扩展能力，为用户增长做准备 |
| **优化项** | |
| 负载测试 | 使用 k6/Artillery 模拟1000并发用户；压测核心API（交易创建/列表查询/导入/WebSocket） |
| WebSocket扩展 | 验证多实例WebSocket（Socket.IO Redis Adapter）；测试1000+并发连接 |
| 水平扩展验证 | ACK HPA自动扩缩容验证；验证无状态服务可正确水平扩展（JWT无状态已满足） |
| 数据库压测 | pgbench 压力测试；确定单实例承载上限；出读写分离/分库方案 |
| 限流升级 | 从单机限流（@nestjs/throttler）升级为分布式限流（Redis + lua脚本） |
| CDN优化 | 静态资源缓存命中率分析；边缘缓存策略优化 |
| 灾难恢复演练 | 模拟数据库故障切换；验证备份恢复RTO/RPO |
| **涉及模块** | 基础设施层（无业务代码变更） |
| **工作量** | 后端1人×3周 + 运维/测试2人×3周 |

---

#### M11（功能迭代）：分账建议 + 年报 + 多币种

| 项 | 内容 |
|----|------|
| **目标** | 完善家庭协同深度，上线年度报告，支持多币种 |
| **交付功能** | |
| P2-03 家庭分账智能建议 | 分析多人记账数据 → 输出智能分账建议（谁该付多少给谁）→ 一键确认记录 |
| P2-07 数据导出与年报 | CSV/PDF全量数据导出；年度财务报告（全年收支/投资收益/预算执行/目标达成回顾） |
| 多币种支持 | Transaction增加currency字段 + 汇率服务 + 金额折算展示 + 导入外币处理 |
| **涉及模块** | `ai`（新增split-advisor.service.ts）、`reports`（年报模板）、`transactions`（currency字段）、新建 `exchange-rate` 服务 |
| **工作量** | 后端2人×4周 + 前端2人×4周 + AI1人×2周 |
| **验收标准** | 分账建议采纳率≥30%；年报数据完整准确；多币种折算正确 |

---

#### M12（稳定性迭代）：年度收尾 + 生产加固

| 项 | 内容 |
|----|------|
| **目标** | 一年迭代后的全面加固，为第二年规模化做准备 |
| **优化项** | |
| 灾备体系 | 数据库主从同步验证；OSS跨区域复制；Redis集群/哨兵模式评估 |
| SLA定义 | 制定并文档化SLA（API可用性99.9%/响应时间P95<500ms/数据持久性99.99%） |
| 监控告警完善 | 告警阈值调优（减少误报）；on-call值班制度建立；故障自动恢复脚本 |
| 文档完善 | API文档更新（OpenAPI/Swagger）；架构文档同步更新；运维手册编写 |
| 年度复盘 | 技术债务盘点（剩余债务清单+优先级）；性能基准更新；安全审计复查 |
| 依赖升级 | 依赖安全漏洞扫描（npm audit）；大版本升级评估（React 19/NestJS 11等） |
| **涉及模块** | 全局 |
| **工作量** | 后端2人×3周 + 运维1人×3周 + 测试1人×2周 |

---

### 3.4 迭代甘特图

```
月份  1  2  3  4  5  6  7  8  9  10  11  12
      |--|--|--|--|--|--|--|--|--|---|---|---|
M1    📦 OCR+画像
M2       🔧 性能+测试
M3          📦 健康度+建议
M4             🔧 安全+合规
M5                📦 信用卡+负债
M6                   🔧 数据库优化
M7                      📦 投资组合
M8                         🔧 架构重构
M9                            📦 AI顾问+预测
M10                              🔧 压测+扩展
M11                                 📦 分账+年报+多币种
M12                                    🔧 年度加固

📦 = 功能迭代月    🔧 = 稳定性迭代月
```

### 3.5 PRD需求消化进度

| PRD需求 | 优先级 | 计划月份 | 状态 |
|---------|--------|---------|------|
| P1-01 OCR票据扫描 | P1 | M1 | 计划 |
| P1-02 消费行为画像 | P1 | M1 | 计划 |
| P1-03 家庭财务健康度评分 | P1 | M3 | 计划 |
| P1-04 个性化省钱/理财建议 | P1 | M3 | 计划 |
| P1-05 信用卡账单导入 | P1 | M5 | 计划 |
| P1-06 账单同步状态追踪 | P1 | M5 | 计划 |
| P1-07 分类体系自定义与家庭共享 | P1 | M5 | 计划 |
| P1-08 大额支出标记与家庭通知 | P1 | MVP已含 | ✅ |
| P1-09 周报/季报推送 | P1 | M11 | 计划 |
| P2-01 教育/医疗支出预测 | P2 | M9 | 计划 |
| P2-02 风险保障缺口分析 | P2 | 未排期 | 需保险专业知识 |
| P2-03 家庭分账智能建议 | P2 | M11 | 计划 |
| P2-04 投资组合跟踪 | P2 | M7 | 计划 |
| P2-05 AI对话式财务顾问 | P2 | M9 | 计划 |
| P2-06 多币种支持 | P2 | M11 | 计划 |
| P2-07 数据导出与年报 | P2 | M11 | 计划 |
| 新方向：负债管理 | - | M5 | 计划 |

---

## 4. 技术债务预防策略

### 4.1 代码层面

#### 4.1.1 MVP阶段必须建立的设计模式

| 模式 | 应用位置 | 预防的债务 | 现状 |
|------|---------|-----------|------|
| **策略模式** | `IBillParser` 接口 + Parser工厂 | 新增数据源时无需修改现有代码 | ✅ 已设计 |
| **Provider模式** | `llm.provider.ts` | 外部服务可替换，避免供应商锁定 | ✅ 已设计，建议抽象为接口 |
| **Repository模式** | `prisma.service.ts` 封装 | 数据访问层可替换（如未来迁移到其他ORM） | 🔧 建议MVP建立 |
| **事件驱动** | `@nestjs/event-emitter` | 跨模块解耦，新增模块不修改现有模块 | 🔧 建议MVP引入 |
| **DTO模式** | 所有 Controller 的请求体 | 接口契约清晰，前后端类型对齐 | ✅ 已设计 |
| **守卫模式** | `jwt-auth.guard` / `family-permission.guard` | 权限逻辑集中管理，不散落在业务代码 | ✅ 已设计 |

#### 4.1.2 代码规范约定（MVP阶段强制执行）

```typescript
// 1. 禁止在Service中直接操作Request/Response对象
// ❌ 错误
@Controller('transactions')
export class TransactionsController {
  @Get()
  findAll(@Req() req: Request) {
    const userId = req.headers['user-id']; // 禁止
  }
}
// ✅ 正确
@Controller('transactions')
export class TransactionsController {
  @Get()
  findAll(@CurrentUser() user: UserPayload) {
    return this.service.findAll(user.id);
  }
}

// 2. 禁止在Component中直接调用API
// ❌ 错误
function TransactionList() {
  const [data, setData] = useState();
  useEffect(() => {
    axios.get('/api/transactions').then(setData); // 禁止
  }, []);
}
// ✅ 正确
function TransactionList() {
  const { data } = useTransactions(); // 通过Hook → TanStack Query → service层
}

// 3. 禁止在Prisma Service之外直接使用PrismaClient
// ❌ 错误
@Injectable()
export class SomeService {
  constructor(private prisma: PrismaClient) {} // 禁止直接注入
}
// ✅ 正确
@Injectable()
export class SomeService {
  constructor(private prisma: PrismaService) {} // 通过封装的PrismaService
}

// 4. 所有枚举值集中定义在types/目录，禁止硬编码字符串
// ❌ 错误
if (transaction.type === 'expense') { ... }
// ✅ 正确
if (transaction.type === TransactionType.EXPENSE) { ... }
```

### 4.2 数据库层面

#### 4.2.1 迁移策略

```
原则1：每个Prisma Migration对应一个功能变更，禁止合并多个变更到一个Migration
原则2：生产环境Migration必须先在Staging验证
原则3：破坏性Migration（删列/改类型）分两步：先标记废弃→下个版本删除
原则4：大表加列必须设置默认值或允许NULL，避免锁表
原则5：Migration文件提交到Git，禁止手动修改数据库
```

**MVP阶段关键索引规划**：

```sql
-- 交易表核心查询索引（MVP阶段创建）
CREATE INDEX idx_transactions_family_date ON transactions(ledger_id, date DESC);
CREATE INDEX idx_transactions_category_date ON transactions(category_id, date DESC);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_import ON transactions(import_record_id) WHERE import_record_id IS NOT NULL;

-- 家庭成员查询索引
CREATE INDEX idx_family_members_family ON family_members(family_id);
CREATE INDEX idx_family_members_user ON family_members(user_id);

-- 预算查询索引
CREATE INDEX idx_budgets_family_period ON budgets(family_id, year, month);

-- 通知查询索引
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);
```

#### 4.2.2 数据增长预估与分区规划

| 时间点 | 预计交易量 | 策略 |
|--------|-----------|------|
| MVP上线（M0） | 0 | 单表，上述索引 |
| 6个月（M6） | 5-10万条 | 单表，评估索引效果 |
| 12个月（M12） | 20-50万条 | 评估按月分区 |
| 24个月 | 100万+ | 实施按月分区 + 历史数据归档 |

**分区预案**（M12视数据量决定是否实施）：
```sql
-- 按月分区交易表（预案，不在MVP实施）
CREATE TABLE transactions_partitioned (
  LIKE transactions INCLUDING ALL
) PARTITION BY RANGE (date);

-- 每月一个分区
CREATE TABLE transactions_2026_07 PARTITION OF transactions_partitioned
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
```

### 4.3 基础设施层面

#### 4.3.1 监控渐进式建设

| 阶段 | 监控项 | 工具 | 时机 |
|------|--------|------|------|
| MVP | API响应时间/错误率 | 阿里云ARMS | MVP上线前 |
| MVP | 前端JS错误 | Sentry | MVP上线前 |
| M1 | 业务指标（DAU/记账笔数/导入次数） | 自建Dashboard + ARMS | M1功能开发同步 |
| M2 | 数据库慢查询/连接池 | PostgreSQL pg_stat_statements + ARMS | M2稳定性月 |
| M4 | 安全审计日志 | 阿里云SLS | M4安全月 |
| M6 | Redis内存/命中率 | Redis INFO + ARMS | M6优化月 |
| M10 | 全链路追踪 | ARMS + OpenTelemetry | M10压测月 |

#### 4.3.2 告警体系

| 级别 | 触发条件 | 响应时间 | 通知方式 |
|------|---------|---------|---------|
| P0-紧急 | API不可用/数据库宕机 | 5分钟 | 短信+电话+钉钉 |
| P1-严重 | API错误率>5%/响应P95>2秒 | 15分钟 | 短信+钉钉 |
| P2-警告 | 磁盘使用>80%/Redis内存>80% | 1小时 | 钉钉 |
| P3-提示 | 慢查询增多/缓存命中率下降 | 4小时 | 钉钉 |

#### 4.3.3 CI/CD渐进式建设

| 阶段 | CI/CD能力 | 时机 |
|------|----------|------|
| MVP | GitHub Actions：lint + 类型检查 + 单元测试 → Docker构建 → ACK部署 | MVP开发期 |
| M2 | 增加：E2E测试 → 构建产物大小检查 → 依赖安全扫描 | M2稳定性月 |
| M4 | 增加：代码安全扫描（SonarQube）→ 镜像漏洞扫描 | M4安全月 |
| M8 | 增加：蓝绿部署（替代滚动更新）→ 自动回滚机制 | M8重构月 |
| M10 | 增加：性能基准测试（PR性能回归检测）→ 金丝雀发布 | M10压测月 |

---

## 附录：扩展性评估速查表

```
                    当前架构扩展性雷达图

     报表系统扩展 ─────── 🔧 (3-4周，JSONB已就绪)
    /
   /   投资组合模块 ─────── 🏗️ (5-6周，新模块零侵入)
  /
 ├── 多币种支持 ─────── 🔧 (2周，加字段即可)
  \
   \   税务计算 ─────── 🏗️ (5-6周，需领域知识)
    \
     负债管理 ─────── 🔧 (2-3周，Loan模型+复用现有)

     第三方数据源 ─────── ✅ (Provider模式已建立)
```

**一句话总结**：当前架构的 NestJS 模块化设计 + Prisma + PostgreSQL JSONB + 事件驱动 + Provider 模式的组合，为6个扩展方向提供了良好基础。其中4个方向只需小幅调整（加字段/加模块），2个方向需要新建较大模块但零侵入现有代码。关键是在MVP阶段落实 `currency`/`metadata`/`tags` 三个预留字段 + 事件总线 + LLM Provider 接口抽象，即可将后续扩展成本降到最低。

---

> 本文档由架构师高见远（Gao）基于主架构设计文档补充撰写，聚焦扩展性评估与迭代规划。

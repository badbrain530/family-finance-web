# PRD：家庭财务 × QClaw 智能体接入（MCP Server + per-user API Key）

> 文档类型：简单 PRD（不含竞品 / 市场分析）
> 产出角色：产品经理 许清楚（Xu）
> 版本：v0.1 / 草稿（待用户拍板待确认问题）
> 语言：简体中文

---

## 1. 项目信息

| 项 | 内容 |
|----|------|
| Language | 简体中文 |
| Programming Language | 后端 NestJS 10 + Prisma 5 + PostgreSQL（沿用既有栈）；前端 React 18 + zustand + axios（沿用既有栈） |
| Project Name | `agent_mcp_qclaw_integration` |
| 原始需求复述 | 应用自身不连任何 LLM；用户把自己的自然语言记账 / 财务分析请求交给"装在自己电脑上的 QClaw 智能体"（腾讯电脑管家出品，本地化、端到端加密、微信直连）。智能体通过加密调用**用户自己的 Web API**（MCP Server）完成记账与取数，结论由智能体侧的 LLM 生成。需后端开放 MCP 协议接入 + per-user API Key 鉴权，复用既有业务 service，不新增 LLM 成本、不担幻觉责任、数据主权归用户。 |

---

## 2. 产品目标

**做什么 / 为谁 / 为什么**

我们要在家庭财务系统（部署于 `family-finance.cloud`）之上，新增一个**面向 AI 智能体的机器接口层（MCP Server）**，并用 **per-user API Key** 鉴权替代网页登录态。目标用户是已经（或即将）在自家电脑上安装了 QClaw（"龙虾"）助手的家庭账本用户——他们希望用最自然的方式（微信一句话、或任意对话）记账与查账，而不必打开网页、点击表单。

**架构价值（核心）**：本方案让后端彻底**纯 API 化 + 去 LLM 化**——后端只负责「结构化记账 / 取数 / 统计聚合」等已验证的业务能力，把"听懂自然语言、生成分析结论、对接微信"全部外包给**用户侧的 QClaw 智能体**。这样：① 数据主权 100% 在用户本地（智能体端到端加密、数据不出本机）；② 后端零 LLM 调用成本、零幻觉责任（结论由用户自己的模型生成）；③ 后端复用二期已测 service，几乎不写新业务逻辑，改造成本极低；④ 复用既有 HTTPS/SSL 与 `familyId` 隔离体系，无新基础设施。盈米且慢"投顾龙虾"已验证该模式（申请 Key → QClaw 加 MCP → 调金融工具）完全同构，家庭记账龙虾只是另一个垂直场景。

---

## 3. 用户故事

| # | 用户故事 | 角色 |
|---|----------|------|
| US-1 | 作为账本用户，我希望在网页"设置"里一键**生成**专属 API Key 并能随时**吊销**，以便把 Key 填进自己的 QClaw、且 Key 泄露时能立刻止损。 | 家庭账本用户 |
| US-2 | 作为 QClaw 使用者，我希望把"家庭财务"作为 MCP 服务器添加到 `~/.qclaw/openclaw.json`（填 URL + 我的 API Key），重启后龙虾即能调用记账工具，无需任何代码。 | QClaw 用户 |
| US-3 | 作为微信用户，我发一句"今天花了35块买了点肉"，**ClawBot** 直接帮我记一笔（类别自动识别、金额/商户解析），不必打开 App 手填。 | 微信聊天用户 |
| US-4 | 作为想了解财务状况的用户，我让龙虾"帮我看看这个月钱花哪了"，智能体调用 `getSummary` 拿到结构化数据后**自己生成**可读结论与建议，而非后端吐固定文案。 | 微信 / 桌面用户 |
| US-5（可选） | 作为用户，我也能让龙虾"把刚才那笔退掉"或"每月1号自动记房租"，即**退款 / 周期记账**也由智能体触发，而非只能网页操作。 | 微信 / 桌面用户 |

---

## 4. 需求池

> 优先级：P0 = MVP 必须 / P1 = 应做 / P2 = 可选增强
> 约束：除枚举迁移与一个 Guard / 一个 MCP 接入模块外，**所有业务逻辑复用二期已测 service**，不重写。

### P0（MVP）

| 需求ID | 描述 | 优先级 | 验收标准 |
|--------|------|--------|----------|
| P0-01 | **per-user API Key 生成与吊销**：① 后端新增 `ApiKeyGuard`，从 `X-API-Key` header 取 Key → 映射 `userId` / `familyId`；② 前端"设置"页提供生成 / 列表 / 吊销 UI。Key 与 `familyId` 强绑定，沿用既有 `familyId` 隔离。 | P0 | ① 用户可生成唯一 Key，列表展示掩码 + 创建时间；② 吊销后该 Key 即刻 401；③ 持 Key 请求能正确解析到所属 familyId，且无法越权访问其他 family 数据（用越权用例测）。 |
| P0-02 | **MCP Server 基础框架**：NestJS 接入 `@modelcontextprotocol/sdk` 的 `StreamableHTTPServerTransport`，挂载于 `family-finance.cloud/mcp`（复用现有 HTTPS/SSL）。**注意：必须用 streamable-http，SSE 已淘汰会 401。** | P0 | ① `POST /mcp` 能完成 MCP `initialize` 握手并返回 server 能力；② 工具列表可被 QClaw 拉取；③ 未带合法 `X-API-Key` 的工具调用返回鉴权失败。 |
| P0-03 | **核心 MCP Tools（三个）**：`createTransaction` / `getTransactions` / `getSummary`，内部复用二期 Transaction service 与统计聚合 service。工具自带 JSON Schema 描述（无需 SKILL.md）。 | P0 | ① 三个工具在 MCP 工具列表中可见且 Schema 正确；② QClaw 能成功"记一笔"并在网页账本中查到；③ `getSummary` 返回结构化聚合数据（金额/分类/周期），**不含 LLM 文案**。 |
| P0-04 | **`TransactionSource` 加 `AGENT` 值**：PG ENUM 迁移（沿用二期迁移套路）。智能体记账的来源统一标记为 `AGENT`。`CreateTransactionDto.source` 本就 `@IsOptional`，迁移后天然支持。 | P0 | ① 迁移后枚举包含 `MANUAL / QUICK_RECORD / IMPORT / VOICE / AGENT`；② 经 MCP 创建的交易 `source=AGENT`；③ 现有四类来源交易不受影响。 |
| P0-05 | **`AiReportService` 拆分去 LLM 段**：保留"聚合统计 + 异常检测"纯数据逻辑，删除 / 剥离其"调通义千问生成结构化建议"的 LLM 段（原 `QwenProvider` 调用）。后端从此不烧 LLM、不担幻觉。 | P0 | ① 后端全仓 grep 无 LLM（DashScope/Qwen）运行期调用；② 异常检测 / 统计聚合逻辑仍可用、单测通过；③ 结论生成职责明确转移到 QClaw 侧。 |

### P1（应做）

| 需求ID | 描述 | 优先级 | 验收标准 |
|--------|------|--------|----------|
| P1-01 | **扩展 MCP Tools**：`refundTransaction`（复用二期退款）、`createRecurring`（复用二期周期/分期），支持 US-5。 | P1 | 两工具经 QClaw 调用可正确触发退款 / 创建周期计划，行为与网页入口一致。 |
| P1-02 | **更多统计工具**：如 `getMonthlyStats` / `getAnomalies`（暴露 P0-05 保留的异常检测），丰富智能体分析维度。 | P1 | 工具返回结构化 JSON，字段可读、可支撑智能体生成结论。 |
| P1-03 | **MCP 限流（Rate Limit）**：按 API Key 维度限流，防止智能体误循环调用打爆后端。 | P1 | 单 Key 超阈值后返回 429，正常阈值内不受影响。 |
| P1-04 | **Key scope 细化**：支持 `readonly` / `readwrite` 两种 scope，分析类智能体可只给只读 Key。 | P1 | `readonly` Key 调 `createTransaction` 被拒；`readwrite` 正常。 |
| P1-05 | **接入指引页**：网页内嵌"QClaw 接入教程"（步骤 + 配置 JSON 示例，见 §5）。 | P1 | 用户依页面步骤可在无人工帮助下完成 MCP 添加并联调成功。 |

### P2（可选增强）

| 需求ID | 描述 | 优先级 | 验收标准 |
|--------|------|--------|----------|
| P2-01 | **多家庭账本选择策略**：支持智能体在请求中指定 `ledgerId`，适配多账本用户。 | P2 | 同一 family 多账本时，工具可定位到指定 ledger。 |
| P2-02 | **Webhook 事件推送**：交易创建/退款等事件推送至用户指定地址，供智能体主动提醒。 | P2 | 事件触发后目标地址收到结构化 payload。 |
| P2-03 | **SKILL.md 模版**（可选）：虽工具自带 Schema 已够用，仍提供可选 SKILL 模版降低智能体编排门槛。 | P2 | 模版可被 QClaw Skills 机制识别。 |

---

## 5. UI 设计稿

### 5.1 「API 密钥 / 智能体接入」设置页（前端新增）

```
┌──────────────────────────────────────────────────────────┐
│  设置  ›  智能体接入（QClaw / MCP）                          │
├──────────────────────────────────────────────────────────┤
│  [+ 生成新 API Key]                                        │
│                                                            │
│  ── 我的密钥 ──────────────────────────────────────────   │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ● ak_live_8f3c••••••••••••••••••  readwrite   创建:07-15│  │
│  │                                            [吊销]    │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ● ak_live_1a92••••••••••••••••••  readonly    创建:07-10│  │
│  │                                            [吊销]    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  ── MCP 接入配置（复制到 ~/.qclaw/openclaw.json）────────  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ URL:  https://family-finance.cloud/mcp             │  │
│  │ 传输: streamable-http  （⚠️ 勿用 SSE，已淘汰会 401）  │  │
│  │                                                    │  │
│  │ {                                                  │  │
│  │   "mcp": {                                         │  │
│  │     "servers": {                                   │  │
│  │       "family-finance": {                          │  │
│  │         "url": "https://family-finance.cloud/mcp", │  │
│  │         "transport": "streamable-http",            │  │
│  │         "headers": { "X-API-Key": "ak_live_xxxx" } │  │
│  │       }                                            │  │
│  │     }                                              │  │
│  │   }                                                │  │
│  │ }                                                  │  │
│  │                                            [复制]   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                            │
│  [查看接入指引 →]                                          │
└──────────────────────────────────────────────────────────┘
```

### 5.2 QClaw 接入指引步骤（P1-05 页面内容）

```
步骤 1  在上方"智能体接入"页 [生成新 API Key]，复制 Key 值。
步骤 2  打开本机文件 ~/.qclaw/openclaw.json，按上方配置卡片填入 mcp.servers
        （URL = https://family-finance.cloud/mcp，transport = streamable-http，
          headers.X-API-Key = 你的 Key）。
步骤 3  重启 QClaw gateway（托盘退出重开 / 命令行 restart）。
步骤 4  微信扫码绑定你的 QClaw，聊天框出现「ClawBot」入口即完成。
步骤 5  发一句"今天花了35块买了点肉"→ 龙虾自动调 createTransaction 记账。
步骤 6  问"这个月钱花哪了"→ 龙虾调 getSummary 取数并自己生成结论。
```

> 注：凭证注入点正是 MCP 配置里的 `headers.X-API-Key`，与 per-user API Key 天然同构（参考盈米且慢"投顾龙虾"方案）。

---

## 6. 待确认问题（需用户拍板）

| # | 待确认点 | 选项 / 影响 |
|---|----------|-------------|
| Q1 | **API Key 生命周期** | 是否过期？是否允许多 Key 并存？多 Key 是否各自可设独立 scope？建议：默认永不过期 + 允许多 Key + 每 Key 可独立 `readonly/readwrite`。 |
| Q2 | **MCP 工具粒度** | 退款 / 周期记账是拆成独立工具（`refundTransaction` / `createRecurring`，P1-01）还是合并到一个笼统 `manageTransaction`？建议独立，便于智能体精准编排与限流。 |
| Q3 | **统计分析工具范围** | `getSummary` 之外是否需要 `getMonthlyStats` / `getAnomalies`（P1-02）？首版是否只给 `getSummary` 即可上线？ |
| Q4 | **是否要 Webhook 事件（P2-02）** | 仅被动响应智能体拉取，还是需后端主动推送（如"刚记一笔，提醒你"）？影响实时性与工作量。 |
| Q5 | **多家庭账本选择策略（P2-01）** | 多账本用户如何让智能体区分账本？请求内传 `ledgerId` vs 默认主账本？首版是否只支持单账本、忽略此问题？ |
| Q6 | **Key 吊销 / 重绑影响** | Key 吊销后已写入 `openclaw.json` 的 QClaw 如何处理（会立即失效，需用户重新生成并改配置）？是否提供"轮换"而非硬吊销？ |
| Q7 | **AGENT 来源交易的置信度标记** | 经智能体记账的交易是否仍写入 `aiConfidence` / `aiCorrected` / `metadata`（存 LLM 原始文本）？智能体侧的解析质量是否回写 `ClassificationFeedback`（既有纠错机制）？ |
| Q8 | **限流阈值（P1-03）** | 单 Key 默认 QPS / 日调用上限取多少？需结合家庭场景（日调用量极小）定一个宽松默认值。 |

---

## 附：与现有系统冲突点 & 风险（已纳入上方需求）

1. `AiReportService` 含 LLM 调用 → 由 **P0-05** 拆分去 LLM 段解决。
2. 鉴权是 web 登录态 JWT → 由 **P0-01** 新增 per-user API Key（`ApiKeyGuard`）解决，二者并存（网页仍用 JWT）。
3. `TransactionSource` 无 `AGENT` → 由 **P0-04** ENUM 迁移解决。
4. 缺机器友好契约 → 由 **P0-02/P0-03** 补 MCP 工具 JSON Schema 解决。
5. 全局 `ValidationPipe` 白名单（`whitelist + forbidNonWhitelisted`）→ **不变**，智能体天然发结构化 JSON，契合白名单。
6. 此前担心的「微信 5 秒异步 / MsgId 去重 / openid→JWT 桥接 / 混元替换 Qwen」→ **全部不存在**（微信与 LLM 由 QClaw 自管，本系统只暴露 MCP），已从方案移除相关设计。

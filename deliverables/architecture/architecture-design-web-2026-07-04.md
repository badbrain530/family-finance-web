# 系统架构设计文档：AI驱动的家庭记账与财务规划Web应用

**日期**：2026-07-04
**架构师**：高见远（Gao）
**基于**：需求确认文档 `requirements-confirmation-web-2026-07-04.md` + 原始PRD `prd-family-finance-app-2026-07-04.md`
**状态**：已完成

---

## 目录

1. [实现方案与框架选型](#1-实现方案与框架选型)
2. [文件列表及相对路径](#2-文件列表及相对路径)
3. [数据结构与接口设计](#3-数据结构与接口设计)
4. [程序调用流程](#4-程序调用流程)
5. [任务列表](#5-任务列表)
6. [依赖包列表](#6-依赖包列表)
7. [共享知识（跨文件约定）](#7-共享知识跨文件约定)
8. [待明确事项](#8-待明确事项)

---

## 1. 实现方案与框架选型

### 1.1 整体架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  React SPA (Vite + TypeScript + Tailwind + shadcn/ui)  ││
│  │  PWA Service Worker (离线缓存 + Web Push)               ││
│  └──────────────┬──────────────────┬───────────────────────┘│
└─────────────────┼──────────────────┼────────────────────────┘
                  │ HTTPS            │ WSS
                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    阿里云 SLB / CDN                           │
│              (TLS终止 + 静态资源加速)                          │
└─────────────────┬──────────────────┬────────────────────────┘
                  │                  │
         ┌────────┴────────┐ ┌───────┴────────┐
         ▼                 ▼ │                │
┌─────────────────┐ ┌──────────────────┐     │
│  Nginx 反向代理  │ │  WebSocket 网关   │     │
│  (静态资源+API)  │ │  (Socket.IO)     │     │
└────────┬────────┘ └────────┬─────────┘     │
         │                   │               │
         ▼                   ▼               │
┌────────────────────────────────────────────┘
│           NestJS 后端服务 (Docker 容器)
│  ┌──────────┐ ┌──────────┐ ┌────────────┐
│  │ Auth模块  │ │ 账单导入  │ │  AI 服务    │
│  │ Family   │ │  解析器   │ │ (NLP/分类/  │
│  │ Ledger   │ │(Alipay/  │ │  洞察/LLM)  │
│  │ Trans    │ │ WeChat/  │ │            │
│  │ Budget   │ │ Bank)    │ │            │
│  │ Report   │ │          │ │            │
│  │ Notify   │ │          │ │            │
│  └────┬─────┘ └────┬─────┘ └─────┬──────┘
│       │            │             │
│       ▼            ▼             ▼
│  ┌─────────┐ ┌─────────┐ ┌─────────────┐
│  │PostgreSQL│ │  Redis  │ │  阿里云 OSS  │
│  │(主数据库) │ │(缓存/会话)│ │ (文件存储)   │
│  └─────────┘ └─────────┘ └─────────────┘
│       │
│       ▼
│  ┌─────────────────────┐
│  │  外部 AI 服务        │
│  │  通义千问/文心一言    │
│  │  (LLM API)          │
│  └─────────────────────┘
└─────────────────────────────────────────────┘
```

### 1.2 前端技术栈

| 方面 | 选型 | 理由 |
|------|------|------|
| **框架** | React 18 + TypeScript | 生态最成熟，类型安全降低运行时错误；团队招聘容易；React 18 并发渲染优化大数据量列表性能 |
| **构建工具** | Vite 5 | 开发HMR极快（<100ms）；生产构建基于Rollup，支持代码分割和Tree-shaking；零配置开箱即用 |
| **UI组件库** | shadcn/ui + Tailwind CSS 3 | shadcn/ui基于Radix Primitives提供无样式可访问性组件，代码直接复制到项目中完全可控；Tailwind CSS原子化样式开发效率高，与shadcn/ui天然配合；比MUI更灵活定制，适合需要大屏仪表盘等自定义布局的场景 |
| **状态管理** | Zustand（客户端状态） + TanStack Query v5（服务端状态） | Zustand极简API、无Provider嵌套、TypeScript友好；TanStack Query自动处理缓存/重试/失效/乐观更新，家庭协同场景下多组件数据同步无需手动管理 |
| **图表库** | ECharts 5 | 大屏仪表盘需要丰富图表类型（仪表盘环、趋势折线、分类饼图、热力图等），ECharts功能最全面且性能好；与React集成用echarts-for-react封装 |
| **表格组件** | TanStack Table v8 | 支持排序/筛选/分组/虚拟滚动/行选择，交易列表批量操作场景必需；Headless设计配合Tailwind完全自定义样式 |
| **实时通信** | Socket.IO Client | 与后端Socket.IO Gateway无缝配合，自动重连、房间管理、降级兼容；家庭协同实时同步核心 |
| **路由** | React Router v6 | React生态标准路由方案，支持嵌套路由、懒加载、URL参数 |
| **表单** | React Hook Form + Zod | React Hook Form性能最优（非受控）、Zod提供运行时类型校验且与TypeScript类型联动 |
| **快捷键** | react-hotkeys-hook | 轻量级快捷键管理库，支持全局快捷键（Ctrl+K等）和作用域隔离 |
| **PWA** | vite-plugin-pwa | Vite官方PWA插件，自动生成Service Worker和manifest.json，支持离线缓存和Web Push |
| **国际化** | 暂不引入（MVP仅中文） | 架构预留i18n接入点，后续扩展用react-i18next |

### 1.3 后端技术栈

| 方面 | 选型 | 理由 |
|------|------|------|
| **语言/框架** | Node.js 20 + NestJS 10 | TypeScript全栈统一，前后端共享类型定义；NestJS提供模块化架构、依赖注入、装饰器路由，适合中大型项目规范化开发；与React生态共用工具链 |
| **API风格** | RESTful API + WebSocket | RESTful用于标准CRUD操作（账单导入、交易管理、预算设置等）；WebSocket用于家庭协同实时推送（交易变更、在线状态、预算预警） |
| **ORM** | Prisma 5 | 类型安全的数据库访问，自动生成TypeScript类型；Migration管理规范；支持PostgreSQL全部特性（JSON字段、全文检索等） |
| **认证** | JWT (Access Token + Refresh Token) | Access Token短有效期（15分钟）+ Refresh Token长有效期（7天），双Token机制平衡安全与体验；支持手机号验证码、微信扫码、邮箱三种登录方式 |
| **验证** | class-validator + class-transformer | NestJS原生集成，通过DTO装饰器声明校验规则，自动验证请求体 |
| **WebSocket** | Socket.IO (NestJS Gateway) | NestJS原生支持Socket.IO Gateway，与REST API共用认证中间件；房间机制天然适配家庭协同场景 |
| **任务调度** | @nestjs/schedule | 月报自动生成（每月1日）、预算月末报告、Token清理等定时任务 |
| **文件上传** | Multer + 阿里云OSS | Multer处理multipart上传，文件直接转存OSS；大文件支持分片上传 |

### 1.4 AI能力集成方案

| AI能力 | 集成方案 | 实现细节 |
|--------|----------|----------|
| **账单解析** | 规则引擎 + 格式适配器模式 | 每个平台（支付宝/微信/招行/工行/建行）独立Parser类，实现统一`IBillParser`接口；先用规则匹配文件格式（CSV/HTML/PDF），再按列映射提取交易；PDF用pdf-parse库提取文本后正则匹配 |
| **AI分类** | 规则优先 + LLM兜底混合方案 | Phase 1：基于商户名关键词规则库（500+规则）分类，覆盖率约70%；Phase 2：规则未命中的交易调用通义千问API分类（Prompt含分类体系+用户历史纠正样本）；用户每次纠正都存入`classification_feedback`表，定期批量更新规则库 |
| **NLP记账解析** | 通义千问API + 结构化输出 | 用户输入"午饭28块"→LLM解析为`{amount:28, category:"餐饮", type:"expense", note:"午饭"}`；使用Function Calling确保结构化输出；本地维护常见商户→分类映射缓存减少API调用 |
| **AI洞察月报** | 统计分析 + LLM生成叙述 | 后端先做数据聚合（收支统计、环比、分类占比、异常检测），生成结构化数据；再调用LLM将数据转化为自然语言叙述+可执行建议；模板化确保输出格式一致 |
| **AI对话顾问** | （P2预留）LLM + RAG | 架构预留AI对话模块接口；MVP不实现，但数据模型和API路径预留 |

**LLM服务选型**：通义千问（阿里云），理由：
1. 与部署环境同属阿里云生态，内网调用延迟低
2. 国内合规，数据不出境
3. 支持Function Calling，适合结构化输出场景
4. 按量付费，成本可控

### 1.5 数据存储方案

| 存储类型 | 选型 | 用途 | 理由 |
|----------|------|------|------|
| **主数据库** | PostgreSQL 16 | 交易记录、用户、家庭、账本、预算、分类等全部核心数据 | 支持JSONB字段（存储月报内容、AI分类元数据等半结构化数据）；全文检索（交易搜索）；成熟的事务支持保证家庭协同数据一致性 |
| **缓存** | Redis 7 | JWT会话管理、WebSocket在线状态、预算计算缓存、API限流、分布式锁 | 家庭协同场景需高频查在线状态和预算进度，Redis缓存避免击穿数据库 |
| **文件存储** | 阿里云OSS | 上传的账单文件（CSV/HTML/PDF）、导出的报告文件 | 与ECS内网通信免流量费；生命周期策略自动清理过期文件 |
| **全文搜索** | PostgreSQL内置pg_trgm | MVP阶段交易记录搜索、商户名模糊匹配 | 数据量<100万条时PG内置足够，避免引入Elasticsearch的运维复杂度；后续数据量增大再迁移 |

### 1.6 部署方案

| 方面 | 方案 | 理由 |
|------|------|------|
| **云服务商** | 阿里云华东区（上海） | 中国境内部署满足数据合规要求；华东区网络覆盖全国；与OSS/通义千问内网互通 |
| **容器化** | Docker + 阿里云ACK（Kubernetes） | 容器化保证环境一致性；K8s支持水平扩展（WebSocket连接增多时自动扩容）；滚动更新零停机 |
| **CDN** | 阿里云CDN | 静态资源（JS/CSS/图片/字体）全国加速；减少源站带宽压力 |
| **HTTPS** | 阿里云SSL证书（免费DV证书） | 全站HTTPS，Web Speech API和getUserMedia强制要求HTTPS环境 |
| **监控** | 阿里云ARMS（APM）+ Sentry（前端错误监控） | 后端APM监控接口性能和异常；前端Sentry捕获JS运行时错误 |
| **CI/CD** | GitHub Actions + 阿里云容器镜像服务 | 代码推送→自动构建Docker镜像→推送至ACR→ACK滚动部署 |
| **日志** | 阿里云SLS（日志服务） | 结构化日志收集和查询，支持按TraceID追踪请求链路 |

---

## 2. 文件列表及相对路径

### 2.1 项目根目录结构

```
family-finance/
├── client/                          # 前端项目
├── server/                          # 后端项目
├── docker-compose.yml               # 本地开发环境编排
├── docker-compose.prod.yml          # 生产环境编排
├── .gitignore
├── README.md
└── docs/                            # 项目文档
    └── architecture/
        ├── architecture-design-web-2026-07-04.md   # 本文档
        ├── class-diagram.mermaid                    # 类图
        └── sequence-diagram.mermaid                 # 时序图
```

### 2.2 前端文件列表（client/）

```
client/
├── package.json                              # 依赖声明与脚本
├── vite.config.ts                            # Vite构建配置（含PWA插件）
├── tailwind.config.ts                        # Tailwind CSS配置
├── postcss.config.js                         # PostCSS配置
├── tsconfig.json                             # TypeScript配置
├── tsconfig.node.json                        # Node环境TS配置
├── index.html                                # HTML入口
├── public/
│   ├── manifest.json                         # PWA manifest
│   ├── icons/                                # PWA图标
│   └── favicon.ico
├── src/
│   ├── main.tsx                              # 应用入口，挂载React
│   ├── App.tsx                               # 根组件，路由配置
│   ├── index.css                             # 全局样式 + Tailwind指令
│   ├── vite-env.d.ts                         # Vite环境类型声明
│   │
│   ├── types/                                # TypeScript类型定义
│   │   ├── index.ts                          # 类型统一导出
│   │   ├── user.ts                           # 用户相关类型
│   │   ├── family.ts                         # 家庭/账本/成员类型
│   │   ├── transaction.ts                    # 交易/分类类型
│   │   ├── budget.ts                         # 预算/心愿目标类型
│   │   ├── import.ts                         # 账单导入相关类型
│   │   ├── report.ts                         # 报告相关类型
│   │   ├── notification.ts                   # 通知相关类型
│   │   ├── api.ts                            # API响应/请求类型
│   │   └── websocket.ts                      # WebSocket事件类型
│   │
│   ├── store/                                # Zustand客户端状态
│   │   ├── authStore.ts                      # 认证状态（token/user）
│   │   ├── uiStore.ts                        # UI状态（侧边栏/主题/快捷键面板）
│   │   └── notificationStore.ts              # 通知状态（未读数/列表）
│   │
│   ├── services/                             # API服务层
│   │   ├── api.ts                            # Axios实例 + 请求/响应拦截器
│   │   ├── auth.service.ts                   # 认证API
│   │   ├── user.service.ts                   # 用户API
│   │   ├── family.service.ts                 # 家庭/成员API
│   │   ├── ledger.service.ts                 # 账本API
│   │   ├── transaction.service.ts            # 交易API
│   │   ├── category.service.ts               # 分类API
│   │   ├── import.service.ts                 # 账单导入API
│   │   ├── budget.service.ts                 # 预算/心愿目标API
│   │   ├── report.service.ts                 # 报告API
│   │   ├── notification.service.ts           # 通知API
│   │   ├── dashboard.service.ts              # 仪表盘聚合数据API
│   │   └── socket.service.ts                 # WebSocket连接管理
│   │
│   ├── hooks/                                # 自定义Hooks
│   │   ├── useAuth.ts                        # 认证状态与操作
│   │   ├── useTransactions.ts                # 交易CRUD（TanStack Query）
│   │   ├── useFamily.ts                      # 家庭/成员管理
│   │   ├── useBudget.ts                      # 预算管理
│   │   ├── useCategory.ts                    # 分类管理
│   │   ├── useSocket.ts                      # WebSocket事件订阅
│   │   ├── useHotkeys.ts                     # 全局快捷键注册
│   │   ├── useWebNotification.ts             # Web Notifications API
│   │   ├── useOnlineStatus.ts               # 成员在线状态
│   │   └── useMediaQuery.ts                  # 响应式断点
│   │
│   ├── components/                           # 通用组件
│   │   ├── ui/                               # shadcn/ui基础组件
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── sheet.tsx                     # 侧滑面板
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── select.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── toaster.tsx
│   │   │   ├── table.tsx                     # 基础表格样式
│   │   │   ├── tabs.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── progress.tsx
│   │   │   ├── slider.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── context-menu.tsx             # 右键菜单
│   │   │   ├── command.tsx                   # 命令面板（Ctrl+K基础）
│   │   │   └── calendar.tsx
│   │   ├── layout/                           # 布局组件
│   │   │   ├── AppLayout.tsx                 # 主布局（侧边栏+内容区）
│   │   │   ├── Sidebar.tsx                   # 左侧导航栏
│   │   │   ├── Header.tsx                    # 顶部栏（搜索/通知/用户）
│   │   │   ├── PageContainer.tsx             # 页面容器（标题+面包屑+内容）
│   │   │   └── ResponsiveLayout.tsx          # 响应式布局适配
│   │   ├── common/                           # 通用业务组件
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── OnlineBadge.tsx              # 在线状态绿点
│   │   │   ├── CategoryTag.tsx              # 分类标签
│   │   │   ├── AmountText.tsx               # 金额展示（收入绿/支出红）
│   │   │   └── DateRangePicker.tsx          # 日期范围选择器
│   │   └── charts/                           # ECharts图表组件
│   │       ├── ExpenseTrendChart.tsx         # 支出趋势折线图
│   │       ├── BudgetProgressRing.tsx        # 预算进度环
│   │       ├── CategoryPieChart.tsx          # 分类占比饼图
│   │       ├── MemberContribBar.tsx          # 成员贡献柱状图
│   │       └── MiniSparkline.tsx             # 迷你趋势线
│   │
│   ├── features/                             # 功能模块页面
│   │   ├── auth/                             # 认证
│   │   │   ├── LoginPage.tsx                 # 登录页
│   │   │   ├── RegisterPage.tsx              # 注册页
│   │   │   ├── ForgotPasswordPage.tsx        # 忘记密码
│   │   │   └── WeChatScanLogin.tsx           # 微信扫码登录组件
│   │   │
│   │   ├── onboarding/                       # 新用户引导
│   │   │   ├── OnboardingPage.tsx            # 引导流程主页面
│   │   │   ├── WelcomeStep.tsx               # 欢迎步骤
│   │   │   ├── ModeSelectStep.tsx            # 模式选择（个人/家庭）
│   │   │   ├── QuickRecordGuideStep.tsx      # 快捷键记账引导
│   │   │   ├── ImportGuideStep.tsx           # 账单导入引导
│   │   │   └── BudgetGuideStep.tsx           # 预算设置引导
│   │   │
│   │   ├── dashboard/                        # 大屏仪表盘（W-02, P0-13）
│   │   │   ├── DashboardPage.tsx             # 仪表盘主页面
│   │   │   ├── StatCards.tsx                 # 收支/结余统计卡片
│   │   │   ├── BudgetProgressSection.tsx     # 预算进度环组
│   │   │   ├── RecentTransactionsTable.tsx   # 近期交易表格
│   │   │   ├── TrendMiniChart.tsx            # 趋势迷你图
│   │   │   ├── FamilyMemberContrib.tsx       # 家庭成员贡献
│   │   │   └── WishGoalProgress.tsx          # 心愿目标进度
│   │   │
│   │   ├── transactions/                     # 交易管理（P0-05,06, W-01,03）
│   │   │   ├── TransactionListPage.tsx       # 交易列表页
│   │   │   ├── TransactionDataTable.tsx      # 交易数据表格（排序/筛选/虚拟滚动）
│   │   │   ├── TransactionDetailDrawer.tsx   # 交易详情侧滑
│   │   │   ├── QuickRecordModal.tsx          # Ctrl+K快捷记账浮层
│   │   │   ├── TransactionEditForm.tsx       # 交易编辑表单
│   │   │   ├── BatchOperationToolbar.tsx     # 批量操作工具栏（W-03）
│   │   │   ├── CategorySelect.tsx            # 分类选择器（下拉+搜索）
│   │   │   ├── TransactionFilters.tsx        # 高级筛选面板
│   │   │   └── TransactionContextMenu.tsx    # 右键上下文菜单（编辑/删除/复制）
│   │   │
│   │   ├── import/                           # 账单导入（P0-01,02,03）
│   │   │   ├── ImportPage.tsx                # 导入页面主入口
│   │   │   ├── DragUploadZone.tsx            # 拖拽上传区
│   │   │   ├── PlatformSelect.tsx            # 平台选择（支付宝/微信/银行）
│   │   │   ├── ImportPreviewTable.tsx        # 解析预览表格
│   │   │   ├── BatchClassifyToolbar.tsx      # 批量分类工具栏
│   │   │   ├── ImportSummaryDialog.tsx       # 导入摘要弹窗
│   │   │   └── ImportHistoryList.tsx         # 导入历史记录
│   │   │
│   │   ├── family/                           # 家庭协同（P0-07,08,09）
│   │   │   ├── FamilyPage.tsx                # 家庭账本主页（Tab切换共同/个人）
│   │   │   ├── CreateFamilyPage.tsx          # 创建家庭
│   │   │   ├── JoinFamilyPage.tsx            # 加入家庭（邀请链接）
│   │   │   ├── FamilyMembersPage.tsx         # 成员管理
│   │   │   ├── MemberRoleDialog.tsx          # 角色设置弹窗
│   │   │   ├── InviteLinkCard.tsx            # 邀请链接/二维码卡片
│   │   │   ├── PersonalLedgerView.tsx        # 个人子账本视图
│   │   │   └── OnlineMembersBar.tsx          # 在线成员状态栏
│   │   │
│   │   ├── budget/                           # 预算管理（P0-11,12）
│   │   │   ├── BudgetPage.tsx                # 预算设置主页面
│   │   │   ├── BudgetCategoryForm.tsx        # 分类预算表单（输入+滑块）
│   │   │   ├── AIRrecommendBudget.tsx        # AI推荐预算展示
│   │   │   ├── WishGoalCard.tsx              # 心愿目标卡片
│   │   │   ├── WishGoalDialog.tsx            # 心愿目标创建/编辑
│   │   │   ├── BudgetAlertList.tsx           # 预警历史列表
│   │   │   └── BudgetProgressOverview.tsx    # 预算执行总览
│   │   │
│   │   ├── report/                           # AI财务洞察月报（P0-10）
│   │   │   ├── MonthlyReportPage.tsx         # 月报主页面
│   │   │   ├── ReportSideNav.tsx             # 侧边目录导航
│   │   │   ├── ReportOverviewSection.tsx     # 收支总览章节
│   │   │   ├── SpendingAnalysisSection.tsx   # 消费结构分析章节
│   │   │   ├── AnomalyAlertSection.tsx       # 异常支出提醒章节
│   │   │   ├── AdviceCardsSection.tsx        # 可执行建议卡片
│   │   │   ├── GoalProgressSection.tsx       # 心愿目标进度章节
│   │   │   ├── ReportFeedback.tsx           # 建议反馈收集
│   │   │   └── ExportReportButton.tsx        # 打印/导出PDF按钮
│   │   │
│   │   ├── notifications/                    # 通知中心（P0-12）
│   │   │   ├── NotificationCenter.tsx        # 通知中心面板（Header下拉）
│   │   │   ├── NotificationList.tsx          # 通知列表
│   │   │   └── NotificationSettings.tsx      # 通知偏好设置
│   │   │
│   │   └── settings/                         # 设置
│   │       ├── SettingsPage.tsx              # 设置主页
│   │       ├── ProfileSettings.tsx           # 个人信息设置
│   │       ├── SecuritySettings.tsx          # 安全设置（密码/二次验证）
│   │       └── SubscriptionSettings.tsx      # 订阅管理（预留）
│   │
│   ├── lib/                                  # 工具函数
│   │   ├── utils.ts                          # 通用工具（cn, formatCurrency, formatDate等）
│   │   ├── constants.ts                      # 应用常量（API_URL, 路由路径等）
│   │   ├── categories.ts                     # 默认分类体系（对齐国标8大类）
│   │   ├── pwa.ts                            # PWA Service Worker注册
│   │   └── excelExport.ts                    # 数据导出工具（CSV/Excel）
│   │
│   └── routes/                               # 路由配置
│       ├── index.tsx                         # 路由定义（含懒加载）
│       └── ProtectedRoute.tsx                # 路由守卫（登录验证）
```

### 2.3 后端文件列表（server/）

```
server/
├── package.json                              # 依赖声明与脚本
├── tsconfig.json                             # TypeScript配置
├── tsconfig.build.json                       # 构建用TS配置
├── nest-cli.json                             # NestJS CLI配置
├── Dockerfile                                # Docker构建文件
├── .env.example                              # 环境变量模板
├── .eslintrc.js
├── prisma/
│   ├── schema.prisma                         # Prisma数据模型定义
│   ├── seed.ts                               # 数据库种子数据
│   └── migrations/                           # 数据库迁移文件
│       └── ...
├── src/
│   ├── main.ts                               # 应用入口
│   ├── app.module.ts                         # 根模块
│   │
│   ├── config/                               # 配置
│   │   ├── config.module.ts                  # 配置模块
│   │   ├── configuration.ts                  # 环境变量加载
│   │   ├── jwt.config.ts                     # JWT配置
│   │   ├── database.config.ts                # 数据库配置
│   │   └── oss.config.ts                     # OSS配置
│   │
│   ├── prisma/                               # Prisma服务
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts                 # PrismaClient封装
│   │
│   ├── common/                               # 公共模块
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts     # @CurrentUser() 获取当前用户
│   │   │   ├── roles.decorator.ts            # @Roles() 角色装饰器
│   │   │   └── family-member.decorator.ts    # @FamilyMember() 家庭成员校验
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts             # JWT认证守卫
│   │   │   ├── roles.guard.ts                # 角色权限守卫
│   │   │   └── family-permission.guard.ts    # 家庭操作权限守卫
│   │   ├── interceptors/
│   │   │   ├── transform.interceptor.ts      # 统一响应格式拦截器
│   │   │   └── logging.interceptor.ts        # 请求日志拦截器
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts      # 全局异常过滤器
│   │   ├── pipes/
│   │   │   └── global-validation.pipe.ts     # 全局验证管道
│   │   └── middleware/
│   │       └── cors.middleware.ts            # CORS中间件
│   │
│   ├── modules/                              # 业务模块
│   │   ├── auth/                             # 认证模块
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts            # 注册/登录/刷新/登出
│   │   │   ├── auth.service.ts               # 认证逻辑
│   │   │   ├── jwt.strategy.ts               # JWT策略
│   │   │   ├── wechat.strategy.ts            # 微信扫码策略
│   │   │   └── dto/
│   │   │       ├── register.dto.ts
│   │   │       ├── login.dto.ts
│   │   │       └── refresh-token.dto.ts
│   │   │
│   │   ├── users/                            # 用户模块
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── dto/
│   │   │       └── update-user.dto.ts
│   │   │
│   │   ├── families/                         # 家庭模块
│   │   │   ├── families.module.ts
│   │   │   ├── families.controller.ts        # 创建/查询/邀请/加入/成员管理
│   │   │   ├── families.service.ts
│   │   │   └── dto/
│   │   │       ├── create-family.dto.ts
│   │   │       ├── update-family.dto.ts
│   │   │       ├── invite-member.dto.ts
│   │   │       └── update-member-role.dto.ts
│   │   │
│   │   ├── ledgers/                          # 账本模块
│   │   │   ├── ledgers.module.ts
│   │   │   ├── ledgers.controller.ts
│   │   │   ├── ledgers.service.ts
│   │   │   └── dto/
│   │   │       └── create-ledger.dto.ts
│   │   │
│   │   ├── transactions/                     # 交易模块
│   │   │   ├── transactions.module.ts
│   │   │   ├── transactions.controller.ts    # CRUD + 批量 + 快捷记账
│   │   │   ├── transactions.service.ts
│   │   │   └── dto/
│   │   │       ├── create-transaction.dto.ts
│   │   │       ├── update-transaction.dto.ts
│   │   │       ├── query-transaction.dto.ts
│   │   │       ├── batch-operation.dto.ts
│   │   │       └── quick-record.dto.ts
│   │   │
│   │   ├── categories/                       # 分类模块
│   │   │   ├── categories.module.ts
│   │   │   ├── categories.controller.ts
│   │   │   ├── categories.service.ts
│   │   │   └── dto/
│   │   │       ├── create-category.dto.ts
│   │   │       └── reorder-categories.dto.ts
│   │   │
│   │   ├── imports/                          # 账单导入模块
│   │   │   ├── imports.module.ts
│   │   │   ├── imports.controller.ts         # 上传/预览/确认/历史
│   │   │   ├── imports.service.ts            # 导入流程编排
│   │   │   ├── parsers/                      # 解析器
│   │   │   │   ├── parser.interface.ts       # IBillParser接口
│   │   │   │   ├── parser.factory.ts         # 解析器工厂
│   │   │   │   ├── alipay.parser.ts          # 支付宝解析器
│   │   │   │   ├── wechat.parser.ts          # 微信解析器
│   │   │   │   ├── cmb.parser.ts             # 招商银行解析器
│   │   │   │   ├── icbc.parser.ts            # 工商银行解析器
│   │   │   │   └── ccb.parser.ts             # 建设银行解析器
│   │   │   └── dto/
│   │   │       ├── upload-bill.dto.ts
│   │   │       └── confirm-import.dto.ts
│   │   │
│   │   ├── budgets/                          # 预算模块
│   │   │   ├── budgets.module.ts
│   │   │   ├── budgets.controller.ts         # 预算CRUD + AI推荐 + 进度
│   │   │   ├── budgets.service.ts
│   │   │   ├── wish-goals.service.ts         # 心愿目标服务
│   │   │   └── dto/
│   │   │       ├── create-budget.dto.ts
│   │   │       ├── update-budget.dto.ts
│   │   │       └── create-wish-goal.dto.ts
│   │   │
│   │   ├── reports/                          # 报告模块
│   │   │   ├── reports.module.ts
│   │   │   ├── reports.controller.ts         # 月报查询/生成
│   │   │   ├── reports.service.ts            # 报告生成编排
│   │   │   ├── statistics.service.ts         # 统计分析服务
│   │   │   └── dto/
│   │   │       └── generate-report.dto.ts
│   │   │
│   │   ├── ai/                               # AI服务模块
│   │   │   ├── ai.module.ts
│   │   │   ├── ai.controller.ts              # AI相关API端点
│   │   │   ├── classification.service.ts     # AI分类服务
│   │   │   ├── nlp.service.ts                # NLP记账解析服务
│   │   │   ├── insight.service.ts            # AI洞察生成服务
│   │   │   ├── llm.provider.ts               # 通义千问LLM调用封装
│   │   │   ├── rules.engine.ts               # 规则引擎（分类关键词匹配）
│   │   │   └── dto/
│   │   │       ├── classify-request.dto.ts
│   │   │       └── quick-parse.dto.ts
│   │   │
│   │   ├── notifications/                    # 通知模块
│   │   │   ├── notifications.module.ts
│   │   │   ├── notifications.controller.ts   # 通知列表/已读/订阅
│   │   │   ├── notifications.service.ts      # 通知逻辑
│   │   │   ├── web-push.service.ts           # Web Push推送
│   │   │   ├── email.service.ts              # 邮件发送
│   │   │   └── dto/
│   │   │       └── subscribe-push.dto.ts
│   │   │
│   │   ├── websocket/                        # WebSocket模块
│   │   │   ├── websocket.module.ts
│   │   │   ├── websocket.gateway.ts          # Socket.IO网关
│   │   │   └── websocket.service.ts          # 事件广播服务
│   │   │
│   │   └── dashboard/                        # 仪表盘聚合模块
│   │       ├── dashboard.module.ts
│   │       ├── dashboard.controller.ts       # 仪表盘聚合数据
│   │       └── dashboard.service.ts          # 多表聚合查询
│   │
│   ├── tasks/                                # 定时任务
│   │   ├── tasks.module.ts
│   │   ├── monthly-report.task.ts            # 月度报告自动生成（每月1日）
│   │   ├── budget-alert.task.ts              # 预算预警检查（每日）
│   │   └── token-cleanup.task.ts             # 过期Token清理（每日）
│   │
│   └── utils/                                # 工具函数
│       ├── crypto.util.ts                    # AES-256加解密
│       ├── date.util.ts                      # 日期处理工具
│       ├── id.util.ts                        # ID生成（nanoid）
│       └── logger.ts                         # Winston日志配置
│
└── test/                                     # 测试
    ├── unit/                                 # 单元测试
    └── e2e/                                  # E2E测试
```

---

## 3. 数据结构与接口设计

### 3.1 核心数据模型（TypeScript接口定义）

```typescript
// ============ 用户与认证 ============

interface User {
  id: string;
  phone: string | null;           // 手机号（加密存储）
  email: string | null;           // 邮箱（加密存储）
  passwordHash: string | null;    // 密码哈希（手机号/邮箱注册时）
  wechatOpenId: string | null;    // 微信OpenID
  nickname: string;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}

enum MemberRole {
  OWNER = 'owner',        // 创建者（最高权限）
  ADMIN = 'admin',        // 管理员（记账+管理成员）
  MEMBER = 'member',      // 普通成员（记账+查看）
  VIEWER = 'viewer',      // 只读成员（仅查看）
}

// ============ 家庭与账本 ============

interface Family {
  id: string;
  name: string;                   // 家庭名称
  ownerId: string;                // 创建者userId
  avatar: string | null;
  inviteCode: string;             // 邀请码（6位）
  inviteCodeExpiry: Date;         // 邀请码过期时间
  createdAt: Date;
  updatedAt: Date;
}

interface FamilyMember {
  id: string;
  familyId: string;
  userId: string;
  role: MemberRole;
  joinedAt: Date;
  // 关联
  family: Family;
  user: User;
}

enum LedgerType {
  SHARED = 'shared',     // 家庭共同账本
  PERSONAL = 'personal', // 个人子账本
}

interface Ledger {
  id: string;
  familyId: string;
  ownerId: string;                // 个人子账本的owner（共同账本为null）
  type: LedgerType;
  name: string;
  createdAt: Date;
}

// ============ 分类 ============

interface Category {
  id: string;
  familyId: string;               // 分类属于家庭级别
  parentId: string | null;        // 父分类ID（null为一级分类）
  name: string;
  icon: string;                   // 图标标识
  color: string;                  // 颜色 hex
  sortOrder: number;              // 排序序号
  isSystem: boolean;              // 是否系统默认（不可删除）
  createdAt: Date;
}

// ============ 交易 ============

enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
  TRANSFER = 'transfer',   // 内部转账（预留）
}

enum TransactionSource {
  MANUAL = 'manual',           // 手动记账
  QUICK_RECORD = 'quick_record', // Ctrl+K快捷记账
  IMPORT = 'import',           // 账单导入
  VOICE = 'voice',             // 语音记账（P2预留）
}

interface Transaction {
  id: string;
  ledgerId: string;               // 所属账本
  userId: string;                 // 记账人
  categoryId: string | null;      // 分类ID（AI分类后填入）
  type: TransactionType;
  amount: number;                 // 金额（正数，类型由type决定）
  date: Date;                     // 交易日期
  merchant: string | null;        // 商户名
  note: string | null;            // 备注
  source: TransactionSource;      // 来源
  importRecordId: string | null;  // 关联导入记录
  aiConfidence: number | null;    // AI分类置信度 0-1
  aiCorrected: boolean;           // 用户是否纠正过分类
  isLargeExpense: boolean;        // 是否大额支出（超过阈值）
  createdAt: Date;
  updatedAt: Date;
}

// ============ 账单导入 ============

enum ImportPlatform {
  ALIPAY = 'alipay',
  WECHAT = 'wechat',
  CMB = 'cmb',           // 招商银行
  ICBC = 'icbc',         // 工商银行
  CCB = 'ccb',           // 建设银行
}

enum ImportStatus {
  PENDING = 'pending',       // 等待解析
  PARSING = 'parsing',       // 解析中
  PREVIEW = 'preview',       // 待确认预览
  CONFIRMED = 'confirmed',   // 已确认导入
  FAILED = 'failed',         // 解析失败
}

interface ImportRecord {
  id: string;
  userId: string;
  familyId: string;
  ledgerId: string;               // 导入到哪个账本
  platform: ImportPlatform;
  fileName: string;
  fileUrl: string;                // OSS文件URL
  totalCount: number;             // 解析出总条数
  successCount: number;           // 成功导入条数
  failedCount: number;            // 失败条数
  aiAccuracy: number | null;      // AI分类准确率
  status: ImportStatus;
  errorMessage: string | null;
  createdAt: Date;
  confirmedAt: Date | null;
}

// ============ 预算与心愿目标 ============

interface Budget {
  id: string;
  familyId: string;
  categoryId: string | null;      // null表示总预算
  amount: number;                 // 预算金额
  period: 'monthly';              // 预算周期（MVP仅月度）
  year: number;
  month: number;                  // 1-12
  wishGoalId: string | null;      // 关联心愿目标
  createdAt: Date;
  updatedAt: Date;
}

interface WishGoal {
  id: string;
  familyId: string;
  name: string;                   // 如"日本旅行基金"
  targetAmount: number;
  currentAmount: number;          // 当前已存金额
  targetDate: Date | null;        // 目标完成日期
  icon: string;
  color: string;
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============ 报告 ============

interface MonthlyReport {
  id: string;
  familyId: string;
  year: number;
  month: number;
  // 聚合数据
  totalIncome: number;
  totalExpense: number;
  balance: number;
  previousMonthBalance: number | null;
  // 分类支出明细
  categoryBreakdown: CategoryBreakdown[];
  // 异常支出
  anomalies: AnomalyItem[];
  // AI生成建议
  advice: AdviceItem[];
  // 消费结构对比国标
  benchmarkComparison: BenchmarkComparison | null;
  // 生成时间
  generatedAt: Date;
  // 阅读状态
  readBy: string[];               // 已读用户ID列表
}

interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;             // 占总支出百分比
  previousMonthAmount: number | null;
  trend: 'up' | 'down' | 'flat';
}

interface AnomalyItem {
  type: 'large_single' | 'category_spike' | 'unusual_frequency';
  description: string;
  amount: number;
  categoryId: string | null;
  date: Date;
}

interface AdviceItem {
  id: string;
  category: 'saving' | 'budget' | 'goal' | 'anomaly';
  title: string;
  content: string;                // 自然语言建议
  actionType: string | null;      // 可执行动作类型（如"adjust_budget"）
  actionUrl: string | null;       // 跳转链接
  isHelpful: boolean | null;      // 用户反馈
}

// ============ 通知 ============

enum NotificationType {
  BUDGET_WARNING = 'budget_warning',   // 预算预警
  BUDGET_EXCEEDED = 'budget_exceeded',  // 预算超支
  BUDGET_SUCCESS = 'budget_success',    // 预算达成
  LARGE_EXPENSE = 'large_expense',      // 大额支出
  MONTHLY_REPORT = 'monthly_report',    // 月报生成
  FAMILY_MEMBER_JOIN = 'member_join',   // 成员加入
  IMPORT_COMPLETE = 'import_complete',  // 导入完成
}

interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  data: Record<string, any>;      // 附加数据（如跳转参数）
  isRead: boolean;
  createdAt: Date;
}

// ============ AI分类反馈 ============

interface ClassificationFeedback {
  id: string;
  transactionId: string;
  userId: string;
  originalCategoryId: string | null;
  correctedCategoryId: string;
  merchant: string;
  amount: number;
  createdAt: Date;
}
```

### 3.2 RESTful API列表

#### 认证 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/api/auth/register` | 用户注册 | `{phone?, email?, password, nickname}` | `{accessToken, refreshToken, user}` |
| POST | `/api/auth/login` | 登录 | `{phone?, email?, password}` | `{accessToken, refreshToken, user}` |
| POST | `/api/auth/wechat/qr` | 获取微信扫码二维码 | - | `{qrUrl, ticket}` |
| POST | `/api/auth/wechat/callback` | 微信登录回调 | `{code}` | `{accessToken, refreshToken, user}` |
| POST | `/api/auth/refresh` | 刷新Token | `{refreshToken}` | `{accessToken, refreshToken}` |
| POST | `/api/auth/logout` | 登出 | `{refreshToken}` | `{success}` |

#### 用户 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/users/me` | 获取当前用户 | - | `User` |
| PUT | `/api/users/me` | 更新个人信息 | `{nickname?, avatar?}` | `User` |
| PUT | `/api/users/password` | 修改密码 | `{oldPassword, newPassword}` | `{success}` |

#### 家庭 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/api/families` | 创建家庭 | `{name}` | `Family` |
| GET | `/api/families/current` | 获取当前家庭 | - | `Family` |
| PUT | `/api/families/:id` | 更新家庭信息 | `{name?, avatar?}` | `Family` |
| POST | `/api/families/:id/invite` | 生成邀请码 | - | `{inviteCode, expireAt}` |
| POST | `/api/families/join` | 通过邀请码加入 | `{inviteCode}` | `FamilyMember` |
| GET | `/api/families/:id/members` | 获取成员列表 | - | `FamilyMember[]` |
| PUT | `/api/families/:id/members/:userId` | 更新成员角色 | `{role}` | `FamilyMember` |
| DELETE | `/api/families/:id/members/:userId` | 移除成员 | - | `{success}` |
| GET | `/api/families/:id/members/online` | 获取在线成员 | - | `string[]` (userId列表) |

#### 账本 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/families/:familyId/ledgers` | 获取账本列表 | - | `Ledger[]` |
| POST | `/api/families/:familyId/ledgers` | 创建个人子账本 | `{name}` | `Ledger` |

#### 交易 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/transactions` | 交易列表（分页+筛选） | Query: `ledgerId, categoryId, type, dateFrom, dateTo, minAmount, maxAmount, keyword, memberId, page, pageSize, sortBy, sortOrder` | `{items: Transaction[], total, page, pageSize}` |
| POST | `/api/transactions` | 创建交易 | `CreateTransactionDto` | `Transaction` |
| POST | `/api/transactions/batch` | 批量创建 | `{transactions: CreateTransactionDto[]}` | `{successCount, failedCount}` |
| GET | `/api/transactions/:id` | 交易详情 | - | `Transaction` |
| PUT | `/api/transactions/:id` | 更新交易 | `UpdateTransactionDto` | `Transaction` |
| DELETE | `/api/transactions/:id` | 删除交易 | - | `{success}` |
| POST | `/api/transactions/batch/delete` | 批量删除 | `{ids: string[]}` | `{successCount}` |
| POST | `/api/transactions/batch/classify` | 批量修改分类 | `{ids: string[], categoryId}` | `{successCount}` |
| POST | `/api/transactions/quick-record` | Ctrl+K快捷记账 | `{input: string, ledgerId}` | `{transaction, confidence, undoToken}` |
| POST | `/api/transactions/:id/correct` | 纠正分类（AI学习） | `{categoryId}` | `{success}` |
| POST | `/api/transactions/:id/undo` | 撤销最近记账 | `{undoToken}` | `{success}` |

#### 分类 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/families/:familyId/categories` | 分类列表 | - | `Category[]`（树形） |
| POST | `/api/families/:familyId/categories` | 创建分类 | `{name, parentId?, icon, color}` | `Category` |
| PUT | `/api/categories/:id` | 更新分类 | `{name?, icon?, color?}` | `Category` |
| DELETE | `/api/categories/:id` | 删除分类 | - | `{success}` |
| PUT | `/api/families/:familyId/categories/reorder` | 重排序 | `{items: {id, sortOrder}[]}` | `{success}` |

#### 账单导入 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/api/imports/upload` | 上传账单文件 | `multipart: file, platform, familyId, ledgerId` | `{importId, status}` |
| GET | `/api/imports/:id` | 获取导入预览 | - | `{importRecord, transactions: ParsedTransaction[]}` |
| POST | `/api/imports/:id/confirm` | 确认导入 | `{corrections: {id, categoryId}[]}` | `{successCount, failedCount, aiAccuracy}` |
| GET | `/api/imports` | 导入历史 | Query: `page, pageSize` | `{items: ImportRecord[], total}` |

#### 预算 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/families/:familyId/budgets` | 预算列表 | Query: `year, month` | `Budget[]` |
| POST | `/api/families/:familyId/budgets` | 创建/更新预算 | `{categoryId?, amount, year, month, wishGoalId?}` | `Budget` |
| DELETE | `/api/budgets/:id` | 删除预算 | - | `{success}` |
| GET | `/api/families/:familyId/budgets/progress` | 预算执行进度 | Query: `year, month` | `{total: {budget, spent, remaining, percentage}, categories: [...]}` |
| POST | `/api/families/:familyId/budgets/ai-recommend` | AI推荐预算 | `{year, month}` | `{recommendations: {categoryId, amount, reason}[]}` |

#### 心愿目标 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/families/:familyId/wish-goals` | 心愿目标列表 | - | `WishGoal[]` |
| POST | `/api/families/:familyId/wish-goals` | 创建心愿目标 | `{name, targetAmount, targetDate?, icon, color}` | `WishGoal` |
| PUT | `/api/wish-goals/:id` | 更新心愿目标 | `{name?, targetAmount?, targetDate?}` | `WishGoal` |
| DELETE | `/api/wish-goals/:id` | 删除心愿目标 | - | `{success}` |

#### 报告 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/reports/monthly/:familyId/:year/:month` | 获取月报 | - | `MonthlyReport` |
| POST | `/api/reports/monthly/:familyId/:year/:month/generate` | 手动触发生成 | - | `MonthlyReport` |
| GET | `/api/reports/list/:familyId` | 报告列表 | Query: `page, pageSize` | `{items: MonthlyReport[], total}` |
| POST | `/api/reports/:id/feedback` | 建议反馈 | `{adviceId, isHelpful}` | `{success}` |

#### 仪表盘 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/dashboard/:familyId` | 仪表盘聚合数据 | Query: `year, month` | `DashboardData` |

```typescript
// 仪表盘聚合数据结构
interface DashboardData {
  summary: {
    totalIncome: number;
    totalExpense: number;
    balance: number;
    previousBalance: number;
    balanceTrend: 'up' | 'down' | 'flat';
  };
  budgetProgress: {
    totalBudget: number;
    totalSpent: number;
    percentage: number;
    remaining: number;
  };
  recentTransactions: Transaction[];    // 最近10条
  monthlyTrend: { month: string; income: number; expense: number }[];  // 近6月趋势
  categoryBreakdown: { categoryId: string; name: string; amount: number; color: string }[];
  wishGoals: { id: string; name: string; current: number; target: number; percentage: number }[];
  memberContribution: { userId: string; nickname: string; expense: number; count: number }[];
}
```

#### 通知 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/api/notifications` | 通知列表 | Query: `page, pageSize, isRead?` | `{items: Notification[], total, unreadCount}` |
| PUT | `/api/notifications/:id/read` | 标记已读 | - | `{success}` |
| PUT | `/api/notifications/read-all` | 全部标记已读 | - | `{success}` |
| POST | `/api/notifications/subscribe` | 订阅Web Push | `{subscription: PushSubscription}` | `{success}` |

### 3.3 WebSocket事件列表

#### 客户端 → 服务端

| 事件 | 数据 | 说明 |
|------|------|------|
| `family:join` | `{familyId}` | 加入家庭房间（登录后自动调用） |
| `family:leave` | `{familyId}` | 离开家庭房间（登出/切换家庭） |
| `typing:start` | `{ledgerId}` | 正在记账（可选，显示"XX正在输入"） |

#### 服务端 → 客户端

| 事件 | 数据 | 说明 |
|------|------|------|
| `transaction:created` | `{transaction, ledgerId, userId}` | 新交易创建（家庭同步） |
| `transaction:updated` | `{transaction, ledgerId, userId}` | 交易更新 |
| `transaction:deleted` | `{transactionId, ledgerId, userId}` | 交易删除 |
| `member:online` | `{userId, nickname}` | 成员上线 |
| `member:offline` | `{userId, nickname}` | 成员离线 |
| `budget:alert` | `{type, categoryId, percentage, message}` | 预算预警（80%/100%/月末） |
| `notification:new` | `{notification}` | 新通知 |
| `import:completed` | `{importId, successCount, aiAccuracy}` | 账单导入完成 |
| `report:ready` | `{reportId, year, month}` | 月报生成完成 |

### 3.4 核心数据模型关系（Mermaid类图）

> 详见 `docs/architecture/class-diagram.mermaid`

```mermaid
classDiagram
    class User {
        +string id
        +string phone
        +string email
        +string passwordHash
        +string wechatOpenId
        +string nickname
        +string avatar
        +Date createdAt
        +Date updatedAt
    }

    class Family {
        +string id
        +string name
        +string ownerId
        +string avatar
        +string inviteCode
        +Date inviteCodeExpiry
        +Date createdAt
    }

    class FamilyMember {
        +string id
        +string familyId
        +string userId
        +MemberRole role
        +Date joinedAt
    }

    class Ledger {
        +string id
        +string familyId
        +string ownerId
        +LedgerType type
        +string name
        +Date createdAt
    }

    class Category {
        +string id
        +string familyId
        +string parentId
        +string name
        +string icon
        +string color
        +int sortOrder
        +boolean isSystem
    }

    class Transaction {
        +string id
        +string ledgerId
        +string userId
        +string categoryId
        +TransactionType type
        +decimal amount
        +Date date
        +string merchant
        +string note
        +TransactionSource source
        +string importRecordId
        +float aiConfidence
        +boolean aiCorrected
        +boolean isLargeExpense
        +Date createdAt
    }

    class Budget {
        +string id
        +string familyId
        +string categoryId
        +decimal amount
        +string period
        +int year
        +int month
        +string wishGoalId
    }

    class WishGoal {
        +string id
        +string familyId
        +string name
        +decimal targetAmount
        +decimal currentAmount
        +Date targetDate
        +boolean isCompleted
    }

    class ImportRecord {
        +string id
        +string userId
        +string familyId
        +string ledgerId
        +ImportPlatform platform
        +string fileName
        +string fileUrl
        +int totalCount
        +int successCount
        +ImportStatus status
        +float aiAccuracy
        +Date createdAt
    }

    class MonthlyReport {
        +string id
        +string familyId
        +int year
        +int month
        +decimal totalIncome
        +decimal totalExpense
        +decimal balance
        +json categoryBreakdown
        +json anomalies
        +json advice
        +Date generatedAt
    }

    class Notification {
        +string id
        +string userId
        +NotificationType type
        +string title
        +string content
        +json data
        +boolean isRead
        +Date createdAt
    }

    class ClassificationFeedback {
        +string id
        +string transactionId
        +string userId
        +string originalCategoryId
        +string correctedCategoryId
        +string merchant
        +decimal amount
        +Date createdAt
    }

    User ||--o{ FamilyMember : "joins as"
    Family ||--o{ FamilyMember : "has members"
    Family ||--o{ Ledger : "owns ledgers"
    Family ||--o{ Category : "defines categories"
    Family ||--o{ Budget : "sets budgets"
    Family ||--o{ WishGoal : "has goals"
    Family ||--o{ MonthlyReport : "generates"
    Family ||--|| User : "owned by"
    Ledger ||--o{ Transaction : "contains"
    User ||--o{ Transaction : "creates"
    Category ||--o{ Transaction : "classifies"
    Category ||--o{ Category : "parent of"
    Budget }o--o| WishGoal : "linked to"
    Budget }o--o| Category : "targets"
    User ||--o{ ImportRecord : "uploads"
    ImportRecord ||--o{ Transaction : "produces"
    User ||--o{ Notification : "receives"
    Transaction ||--o{ ClassificationFeedback : "generates feedback"
```

---

## 4. 程序调用流程

### 4.1 账单导入 + AI分类流程

> 详见 `docs/architecture/sequence-diagram.mermaid`

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as 前端
    participant BE as 后端API
    participant FS as 文件存储(OSS)
    participant PF as 解析工厂
    participant P as 平台解析器
    participant AI as AI分类服务
    participant DB as 数据库
    participant WS as WebSocket

    U->>FE: 拖拽文件到上传区
    FE->>FE: 文件类型/大小校验
    FE->>BE: POST /api/imports/upload (multipart)
    BE->>BE: 生成ImportRecord(status=pending)
    BE->>DB: 保存ImportRecord
    BE->>FS: 上传文件到OSS
    BE->>DB: 更新ImportRecord(status=parsing)
    BE->>PF: getParser(platform)
    PF->>PF: 根据platform选择对应Parser
    PF-->>BE: 返回Parser实例
    BE->>P: parse(fileUrl)
    P->>FS: 下载文件
    P->>P: 规则匹配文件格式
    P->>P: 逐行提取交易数据
    P->>P: 字段映射(日期/金额/商户/分类)
    P-->>BE: ParsedTransaction[]
    BE->>AI: classifyBatch(transactions)
    AI->>AI: 1.规则引擎匹配商户关键词
    AI->>AI: 2.未命中→调用通义千问API
    AI->>AI: 3.计算分类置信度
    AI-->>BE: ClassifiedTransaction[]
    BE->>DB: 更新ImportRecord(status=preview)
    BE-->>FE: 返回预览数据(含AI分类+置信度)
    FE-->>U: 展示预览表格
    Note over FE,U: 表格支持：排序/筛选/批量勾选/批量改分类<br/>低置信度高亮标记

    U->>FE: 检查并纠正分类
    U->>FE: 点击"确认导入"
    FE->>BE: POST /api/imports/:id/confirm
    Note right of BE: 请求体含用户纠正的分类映射
    BE->>DB: 批量写入Transaction
    BE->>AI: 保存纠正反馈(ClassificationFeedback)
    BE->>DB: 更新ImportRecord(status=confirmed)
    BE->>WS: 广播 transaction:created 事件
    WS-->>FE: 推送至其他在线成员
    BE-->>FE: 返回导入摘要
    FE-->>U: 显示Toast"成功导入X条，分类准确率Y%"
```

### 4.2 Ctrl+K 快捷键记账流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as 前端
    participant HK as 快捷键Hook
    participant BE as 后端API
    participant NLP as NLP解析服务
    participant CLS as AI分类服务
    participant DB as 数据库
    participant WS as WebSocket

    U->>FE: 按下 Ctrl+K（任意页面）
    FE->>HK: 触发快捷键事件
    HK->>FE: 打开QuickRecordModal
    FE-->>U: 显示记账浮层（输入框自动聚焦）
    U->>FE: 输入"午饭28块" + 按Enter
    FE->>FE: 前端基础校验（非空）
    FE->>BE: POST /api/transactions/quick-record
    Note right of BE: {input: "午饭28块", ledgerId}
    BE->>NLP: parseNaturalLanguage("午饭28块")
    NLP->>NLP: 调用通义千问Function Calling
    NLP->>NLP: Prompt: "提取金额、分类、类型、备注"
    NLP-->>BE: {amount:28, category:"餐饮", type:"expense", note:"午饭"}
    BE->>CLS: classifyTransaction(merchant, amount, category)
    CLS->>CLS: 规则引擎验证+置信度计算
    CLS-->>BE: {categoryId, confidence: 0.92}
    BE->>BE: 置信度>=0.9 → 直接生成记录
    BE->>DB: 写入Transaction
    BE->>DB: 生成undoToken（5分钟有效）
    BE->>WS: 广播 transaction:created
    WS-->>FE: 实时推送给家庭在线成员
    BE-->>FE: {transaction, confidence, undoToken}
    FE-->>U: Toast"已记：餐饮 -28元 [撤销]"
    Note over U,FE: 用户可点击[撤销]在5分钟内撤回

    alt 置信度 < 0.9
        BE-->>FE: {parsedData, confidence: 0.6, needConfirm: true}
        FE-->>U: 显示快速确认卡片（预填数据）
        U->>FE: 确认或修改
        FE->>BE: POST /api/transactions（标准创建）
    end
```

### 4.3 家庭协同实时同步流程

```mermaid
sequenceDiagram
    participant UA as 成员A（手机浏览器）
    participant FA as 前端A
    participant UB as 成员B（PC浏览器）
    participant FB as 前端B
    participant WS as WebSocket网关
    participant BE as 后端API
    participant DB as 数据库
    participant RD as Redis

    Note over UA,UB: 场景：成员A记账，成员B实时看到更新

    %% 初始连接
    FA->>WS: 建立WebSocket连接
    FA->>WS: family:join {familyId}
    WS->>RD: 记录userId→socketId映射
    WS->>RD: 添加到family:{id}在线集合
    WS-->>FB: 推送 member:online {userId: A}
    FB-->>UB: 显示成员A在线绿点

    %% 记账操作
    UA->>FA: 创建交易"买菜56元"
    FA->>BE: POST /api/transactions
    BE->>BE: 验证权限（FamilyPermissionGuard）
    BE->>DB: 写入Transaction
    BE-->>FA: 返回成功 + Transaction数据
    FA-->>UA: 显示Toast"已记：食品 -56元"

    %% 实时同步
    BE->>WS: broadcastToFamily(familyId, 'transaction:created', data)
    WS->>RD: 查询family:{id}在线成员socketId
    WS-->>FB: 推送 transaction:created {transaction, userId: A}

    %% 前端B处理
    FB->>FB: React Query invalidateQueries(['transactions'])
    FB->>BE: GET /api/transactions?since=lastUpdate
    BE->>DB: 查询增量数据
    BE-->>FB: 返回新交易数据
    FB->>FB: 更新交易列表（乐观更新）
    FB->>FB: 更新仪表盘统计数据
    FB-->>UB: 页面无刷新更新，显示新交易

    %% 预算预警检查
    BE->>BE: 检查该交易是否触发预算阈值
    alt 支出达预算80%
        BE->>WS: emit budget:alert {type:'warning', categoryId, percentage:0.82}
        WS-->>FA: 推送预算预警
        WS-->>FB: 推送预算预警
        FA->>FA: 触发Web Notification（已授权）
        FA-->>UA: 系统通知"食品预算已用82%，加油！"
        BE->>DB: 写入Notification记录
    end

    %% 离线处理
    UA->>FA: 关闭浏览器
    FA->>WS: 断开连接
    WS->>RD: 移除userId→socketId映射
    WS->>RD: 从family:{id}在线集合移除
    WS-->>FB: 推送 member:offline {userId: A}
    FB-->>UB: 成员A绿点变灰
```

---

## 5. 任务列表

### 5.1 任务概览

| 任务ID | 任务名称 | 优先级 | 依赖 | 预计文件数 | MVP必需 |
|--------|----------|--------|------|-----------|---------|
| T01 | 项目基础设施搭建 | P0 | 无 | ~25 | ✅ |
| T02 | 数据层 + 后端核心服务 | P0 | T01 | ~45 | ✅ |
| T03 | 前端核心UI与页面 | P0 | T01 | ~50 | ✅ |
| T04 | 账单导入与AI服务 | P0 | T02 | ~20 | ✅ |
| T05 | 实时协同 + 预算 + 通知 | P0 | T02, T03 | ~25 | ✅ |

### 5.2 详细任务说明

---

#### T01：项目基础设施搭建

**任务描述**：搭建前后端项目脚手架，配置构建工具、代码规范、环境变量、Docker容器化，确保项目可启动运行。

**源文件**：

前端：
- `client/package.json` — 前端依赖声明与npm scripts
- `client/vite.config.ts` — Vite构建配置（含PWA插件、代理配置）
- `client/tailwind.config.ts` — Tailwind CSS主题与扩展配置
- `client/postcss.config.js` — PostCSS配置
- `client/tsconfig.json` — TypeScript编译配置
- `client/tsconfig.node.json` — Node环境TS配置
- `client/index.html` — HTML入口
- `client/src/main.tsx` — React应用入口
- `client/src/App.tsx` — 根组件（路由配置框架）
- `client/src/index.css` — 全局样式 + Tailwind指令
- `client/src/vite-env.d.ts` — Vite环境类型声明
- `client/public/manifest.json` — PWA manifest配置
- `client/.eslintrc.cjs` — ESLint配置

后端：
- `server/package.json` — 后端依赖声明与npm scripts
- `server/tsconfig.json` — TypeScript编译配置
- `server/tsconfig.build.json` — 构建用TS配置
- `server/nest-cli.json` — NestJS CLI配置
- `server/Dockerfile` — 后端Docker构建文件
- `server/.env.example` — 环境变量模板
- `server/.eslintrc.js` — ESLint配置
- `server/src/main.ts` — NestJS应用入口（端口/CORS/全局管道）
- `server/src/app.module.ts` — 根模块（模块注册框架）
- `server/src/config/config.module.ts` — 配置模块
- `server/src/config/configuration.ts` — 环境变量加载
- `server/prisma/schema.prisma` — Prisma数据模型定义（完整）
- `server/prisma/seed.ts` — 种子数据脚本

根目录：
- `docker-compose.yml` — 本地开发环境编排（PG + Redis）
- `docker-compose.prod.yml` — 生产环境编排
- `.gitignore` — Git忽略规则

**依赖**：无
**优先级**：P0

---

#### T02：数据层 + 后端核心服务

**任务描述**：实现Prisma数据库模型与Migration，完成认证模块（注册/登录/JWT/微信扫码）、用户模块、家庭模块（创建/邀请/成员管理/权限）、账本模块、交易模块（CRUD/批量/快捷记账/分类纠正）、分类模块、仪表盘聚合模块，以及公共基础设施（守卫/拦截器/过滤器/装饰器）。

**源文件**：

Prisma与配置：
- `server/src/prisma/prisma.module.ts` — Prisma模块
- `server/src/prisma/prisma.service.ts` — PrismaClient封装（生命周期管理）
- `server/src/config/jwt.config.ts` — JWT配置
- `server/src/config/database.config.ts` — 数据库配置
- `server/src/config/oss.config.ts` — OSS配置

公共基础设施：
- `server/src/common/decorators/current-user.decorator.ts` — @CurrentUser()
- `server/src/common/decorators/roles.decorator.ts` — @Roles()
- `server/src/common/decorators/family-member.decorator.ts` — @FamilyMember()
- `server/src/common/guards/jwt-auth.guard.ts` — JWT认证守卫
- `server/src/common/guards/roles.guard.ts` — 角色权限守卫
- `server/src/common/guards/family-permission.guard.ts` — 家庭操作权限守卫
- `server/src/common/interceptors/transform.interceptor.ts` — 统一响应格式
- `server/src/common/interceptors/logging.interceptor.ts` — 请求日志
- `server/src/common/filters/http-exception.filter.ts` — 全局异常过滤器
- `server/src/common/pipes/global-validation.pipe.ts` — 全局验证管道
- `server/src/common/middleware/cors.middleware.ts` — CORS配置
- `server/src/utils/crypto.util.ts` — AES-256加解密工具
- `server/src/utils/date.util.ts` — 日期处理工具
- `server/src/utils/id.util.ts` — ID生成工具
- `server/src/utils/logger.ts` — Winston日志配置

认证模块：
- `server/src/modules/auth/auth.module.ts`
- `server/src/modules/auth/auth.controller.ts` — 注册/登录/刷新/登出/微信
- `server/src/modules/auth/auth.service.ts` — 认证业务逻辑
- `server/src/modules/auth/jwt.strategy.ts` — JWT策略
- `server/src/modules/auth/wechat.strategy.ts` — 微信扫码策略
- `server/src/modules/auth/dto/register.dto.ts`
- `server/src/modules/auth/dto/login.dto.ts`
- `server/src/modules/auth/dto/refresh-token.dto.ts`

用户模块：
- `server/src/modules/users/users.module.ts`
- `server/src/modules/users/users.controller.ts`
- `server/src/modules/users/users.service.ts`
- `server/src/modules/users/dto/update-user.dto.ts`

家庭模块：
- `server/src/modules/families/families.module.ts`
- `server/src/modules/families/families.controller.ts`
- `server/src/modules/families/families.service.ts`
- `server/src/modules/families/dto/create-family.dto.ts`
- `server/src/modules/families/dto/update-family.dto.ts`
- `server/src/modules/families/dto/invite-member.dto.ts`
- `server/src/modules/families/dto/update-member-role.dto.ts`

账本模块：
- `server/src/modules/ledgers/ledgers.module.ts`
- `server/src/modules/ledgers/ledgers.controller.ts`
- `server/src/modules/ledgers/ledgers.service.ts`
- `server/src/modules/ledgers/dto/create-ledger.dto.ts`

交易模块：
- `server/src/modules/transactions/transactions.module.ts`
- `server/src/modules/transactions/transactions.controller.ts`
- `server/src/modules/transactions/transactions.service.ts`
- `server/src/modules/transactions/dto/create-transaction.dto.ts`
- `server/src/modules/transactions/dto/update-transaction.dto.ts`
- `server/src/modules/transactions/dto/query-transaction.dto.ts`
- `server/src/modules/transactions/dto/batch-operation.dto.ts`
- `server/src/modules/transactions/dto/quick-record.dto.ts`

分类模块：
- `server/src/modules/categories/categories.module.ts`
- `server/src/modules/categories/categories.controller.ts`
- `server/src/modules/categories/categories.service.ts`
- `server/src/modules/categories/dto/create-category.dto.ts`
- `server/src/modules/categories/dto/reorder-categories.dto.ts`

仪表盘模块：
- `server/src/modules/dashboard/dashboard.module.ts`
- `server/src/modules/dashboard/dashboard.controller.ts`
- `server/src/modules/dashboard/dashboard.service.ts`

前端数据层：
- `client/src/types/index.ts` — 类型统一导出
- `client/src/types/user.ts`
- `client/src/types/family.ts`
- `client/src/types/transaction.ts`
- `client/src/types/budget.ts`
- `client/src/types/import.ts`
- `client/src/types/report.ts`
- `client/src/types/notification.ts`
- `client/src/types/api.ts`
- `client/src/types/websocket.ts`
- `client/src/services/api.ts` — Axios实例+拦截器
- `client/src/services/auth.service.ts`
- `client/src/services/user.service.ts`
- `client/src/services/family.service.ts`
- `client/src/services/ledger.service.ts`
- `client/src/services/transaction.service.ts`
- `client/src/services/category.service.ts`
- `client/src/services/dashboard.service.ts`
- `client/src/store/authStore.ts` — 认证状态
- `client/src/store/uiStore.ts` — UI状态
- `client/src/lib/utils.ts` — 通用工具函数
- `client/src/lib/constants.ts` — 应用常量
- `client/src/lib/categories.ts` — 默认分类体系

**依赖**：T01
**优先级**：P0

---

#### T03：前端核心UI与页面

**任务描述**：实现全部前端UI组件和核心页面，包括shadcn/ui基础组件、布局组件、图表组件、认证页面、引导流程、大屏仪表盘、交易列表（含批量操作/快捷键/右键菜单/高级筛选）、设置页面和路由配置。

**源文件**：

基础UI组件（shadcn/ui）：
- `client/src/components/ui/button.tsx`
- `client/src/components/ui/input.tsx`
- `client/src/components/ui/textarea.tsx`
- `client/src/components/ui/dialog.tsx`
- `client/src/components/ui/sheet.tsx`
- `client/src/components/ui/dropdown-menu.tsx`
- `client/src/components/ui/select.tsx`
- `client/src/components/ui/toast.tsx`
- `client/src/components/ui/toaster.tsx`
- `client/src/components/ui/table.tsx`
- `client/src/components/ui/tabs.tsx`
- `client/src/components/ui/badge.tsx`
- `client/src/components/ui/progress.tsx`
- `client/src/components/ui/slider.tsx`
- `client/src/components/ui/checkbox.tsx`
- `client/src/components/ui/tooltip.tsx`
- `client/src/components/ui/popover.tsx`
- `client/src/components/ui/context-menu.tsx`
- `client/src/components/ui/command.tsx`

布局组件：
- `client/src/components/layout/AppLayout.tsx`
- `client/src/components/layout/Sidebar.tsx`
- `client/src/components/layout/Header.tsx`
- `client/src/components/layout/PageContainer.tsx`
- `client/src/components/layout/ResponsiveLayout.tsx`

通用业务组件：
- `client/src/components/common/LoadingSpinner.tsx`
- `client/src/components/common/EmptyState.tsx`
- `client/src/components/common/ErrorBoundary.tsx`
- `client/src/components/common/ConfirmDialog.tsx`
- `client/src/components/common/OnlineBadge.tsx`
- `client/src/components/common/CategoryTag.tsx`
- `client/src/components/common/AmountText.tsx`
- `client/src/components/common/DateRangePicker.tsx`

图表组件：
- `client/src/components/charts/ExpenseTrendChart.tsx`
- `client/src/components/charts/BudgetProgressRing.tsx`
- `client/src/components/charts/CategoryPieChart.tsx`
- `client/src/components/charts/MemberContribBar.tsx`
- `client/src/components/charts/MiniSparkline.tsx`

认证页面：
- `client/src/features/auth/LoginPage.tsx`
- `client/src/features/auth/RegisterPage.tsx`
- `client/src/features/auth/ForgotPasswordPage.tsx`
- `client/src/features/auth/WeChatScanLogin.tsx`

引导流程：
- `client/src/features/onboarding/OnboardingPage.tsx`
- `client/src/features/onboarding/WelcomeStep.tsx`
- `client/src/features/onboarding/ModeSelectStep.tsx`
- `client/src/features/onboarding/QuickRecordGuideStep.tsx`
- `client/src/features/onboarding/ImportGuideStep.tsx`
- `client/src/features/onboarding/BudgetGuideStep.tsx`

大屏仪表盘（W-02, P0-13）：
- `client/src/features/dashboard/DashboardPage.tsx`
- `client/src/features/dashboard/StatCards.tsx`
- `client/src/features/dashboard/BudgetProgressSection.tsx`
- `client/src/features/dashboard/RecentTransactionsTable.tsx`
- `client/src/features/dashboard/TrendMiniChart.tsx`
- `client/src/features/dashboard/FamilyMemberContrib.tsx`
- `client/src/features/dashboard/WishGoalProgress.tsx`

交易管理（P0-05, P0-06, W-01, W-03）：
- `client/src/features/transactions/TransactionListPage.tsx`
- `client/src/features/transactions/TransactionDataTable.tsx`
- `client/src/features/transactions/TransactionDetailDrawer.tsx`
- `client/src/features/transactions/QuickRecordModal.tsx`
- `client/src/features/transactions/TransactionEditForm.tsx`
- `client/src/features/transactions/BatchOperationToolbar.tsx`
- `client/src/features/transactions/CategorySelect.tsx`
- `client/src/features/transactions/TransactionFilters.tsx`
- `client/src/features/transactions/TransactionContextMenu.tsx`

设置：
- `client/src/features/settings/SettingsPage.tsx`
- `client/src/features/settings/ProfileSettings.tsx`
- `client/src/features/settings/SecuritySettings.tsx`
- `client/src/features/settings/SubscriptionSettings.tsx`

路由与Hooks：
- `client/src/routes/index.tsx` — 路由定义（含懒加载）
- `client/src/routes/ProtectedRoute.tsx` — 路由守卫
- `client/src/hooks/useAuth.ts`
- `client/src/hooks/useTransactions.ts`
- `client/src/hooks/useFamily.ts`
- `client/src/hooks/useCategory.ts`
- `client/src/hooks/useHotkeys.ts` — 全局快捷键系统（W-01）
- `client/src/hooks/useMediaQuery.ts`

**依赖**：T01
**优先级**：P0

---

#### T04：账单导入与AI服务

**任务描述**：实现5个平台的账单解析器（支付宝/微信/招行/工行/建行）、AI分类服务（规则引擎+LLM）、NLP记账解析、AI洞察月报生成，以及前端导入页面和报告页面。

**源文件**：

后端-账单导入模块：
- `server/src/modules/imports/imports.module.ts`
- `server/src/modules/imports/imports.controller.ts` — 上传/预览/确认/历史
- `server/src/modules/imports/imports.service.ts` — 导入流程编排
- `server/src/modules/imports/parsers/parser.interface.ts` — IBillParser接口
- `server/src/modules/imports/parsers/parser.factory.ts` — 解析器工厂
- `server/src/modules/imports/parsers/alipay.parser.ts` — 支付宝解析器
- `server/src/modules/imports/parsers/wechat.parser.ts` — 微信解析器
- `server/src/modules/imports/parsers/cmb.parser.ts` — 招商银行解析器
- `server/src/modules/imports/parsers/icbc.parser.ts` — 工商银行解析器
- `server/src/modules/imports/parsers/ccb.parser.ts` — 建设银行解析器
- `server/src/modules/imports/dto/upload-bill.dto.ts`
- `server/src/modules/imports/dto/confirm-import.dto.ts`

后端-AI服务模块：
- `server/src/modules/ai/ai.module.ts`
- `server/src/modules/ai/ai.controller.ts`
- `server/src/modules/ai/classification.service.ts` — AI分类（规则+LLM）
- `server/src/modules/ai/nlp.service.ts` — NLP记账解析
- `server/src/modules/ai/insight.service.ts` — AI洞察生成
- `server/src/modules/ai/llm.provider.ts` — 通义千问API封装
- `server/src/modules/ai/rules.engine.ts` — 规则引擎
- `server/src/modules/ai/dto/classify-request.dto.ts`
- `server/src/modules/ai/dto/quick-parse.dto.ts`

后端-报告模块：
- `server/src/modules/reports/reports.module.ts`
- `server/src/modules/reports/reports.controller.ts`
- `server/src/modules/reports/reports.service.ts` — 月报生成编排
- `server/src/modules/reports/statistics.service.ts` — 统计分析
- `server/src/modules/reports/dto/generate-report.dto.ts`

后端-定时任务：
- `server/src/tasks/tasks.module.ts`
- `server/src/tasks/monthly-report.task.ts` — 月报自动生成
- `server/src/tasks/budget-alert.task.ts` — 预算预警检查
- `server/src/tasks/token-cleanup.task.ts` — Token清理

前端-导入页面：
- `client/src/features/import/ImportPage.tsx`
- `client/src/features/import/DragUploadZone.tsx`
- `client/src/features/import/PlatformSelect.tsx`
- `client/src/features/import/ImportPreviewTable.tsx`
- `client/src/features/import/BatchClassifyToolbar.tsx`
- `client/src/features/import/ImportSummaryDialog.tsx`
- `client/src/features/import/ImportHistoryList.tsx`
- `client/src/services/import.service.ts`
- `client/src/services/report.service.ts`
- `client/src/hooks/useBudget.ts`

前端-报告页面：
- `client/src/features/report/MonthlyReportPage.tsx`
- `client/src/features/report/ReportSideNav.tsx`
- `client/src/features/report/ReportOverviewSection.tsx`
- `client/src/features/report/SpendingAnalysisSection.tsx`
- `client/src/features/report/AnomalyAlertSection.tsx`
- `client/src/features/report/AdviceCardsSection.tsx`
- `client/src/features/report/GoalProgressSection.tsx`
- `client/src/features/report/ReportFeedback.tsx`
- `client/src/features/report/ExportReportButton.tsx`
- `client/src/lib/excelExport.ts` — 数据导出工具

**依赖**：T02
**优先级**：P0

---

#### T05：实时协同 + 预算 + 通知

**任务描述**：实现WebSocket实时协同（家庭房间/交易同步/在线状态/预算预警推送）、预算管理（CRUD/AI推荐/进度/心愿目标关联）、通知系统（Web Push/邮件/站内消息中心），以及前端家庭协同页面、预算页面、通知组件和WebSocket Hooks。

**源文件**：

后端-WebSocket模块：
- `server/src/modules/websocket/websocket.module.ts`
- `server/src/modules/websocket/websocket.gateway.ts` — Socket.IO网关
- `server/src/modules/websocket/websocket.service.ts` — 事件广播

后端-预算模块：
- `server/src/modules/budgets/budgets.module.ts`
- `server/src/modules/budgets/budgets.controller.ts`
- `server/src/modules/budgets/budgets.service.ts`
- `server/src/modules/budgets/wish-goals.service.ts`
- `server/src/modules/budgets/dto/create-budget.dto.ts`
- `server/src/modules/budgets/dto/update-budget.dto.ts`
- `server/src/modules/budgets/dto/create-wish-goal.dto.ts`

后端-通知模块：
- `server/src/modules/notifications/notifications.module.ts`
- `server/src/modules/notifications/notifications.controller.ts`
- `server/src/modules/notifications/notifications.service.ts`
- `server/src/modules/notifications/web-push.service.ts`
- `server/src/modules/notifications/email.service.ts`
- `server/src/modules/notifications/dto/subscribe-push.dto.ts`

前端-WebSocket与Hooks：
- `client/src/services/socket.service.ts` — WebSocket连接管理
- `client/src/hooks/useSocket.ts` — WebSocket事件订阅
- `client/src/hooks/useOnlineStatus.ts` — 成员在线状态
- `client/src/hooks/useWebNotification.ts` — Web Notifications
- `client/src/store/notificationStore.ts` — 通知状态

前端-家庭协同页面：
- `client/src/features/family/FamilyPage.tsx`
- `client/src/features/family/CreateFamilyPage.tsx`
- `client/src/features/family/JoinFamilyPage.tsx`
- `client/src/features/family/FamilyMembersPage.tsx`
- `client/src/features/family/MemberRoleDialog.tsx`
- `client/src/features/family/InviteLinkCard.tsx`
- `client/src/features/family/PersonalLedgerView.tsx`
- `client/src/features/family/OnlineMembersBar.tsx`

前端-预算页面：
- `client/src/features/budget/BudgetPage.tsx`
- `client/src/features/budget/BudgetCategoryForm.tsx`
- `client/src/features/budget/AIRrecommendBudget.tsx`
- `client/src/features/budget/WishGoalCard.tsx`
- `client/src/features/budget/WishGoalDialog.tsx`
- `client/src/features/budget/BudgetAlertList.tsx`
- `client/src/features/budget/BudgetProgressOverview.tsx`
- `client/src/services/budget.service.ts`
- `client/src/services/notification.service.ts`

前端-通知组件：
- `client/src/features/notifications/NotificationCenter.tsx`
- `client/src/features/notifications/NotificationList.tsx`
- `client/src/features/notifications/NotificationSettings.tsx`

前端-PWA：
- `client/src/lib/pwa.ts` — Service Worker注册

**依赖**：T02, T03
**优先级**：P0

---

### 5.3 任务依赖图

```mermaid
graph TD
    T01[T01: 项目基础设施搭建<br/>配置+入口+依赖+Docker<br/>~25文件]
    T02[T02: 数据层+后端核心服务<br/>Prisma+Auth+Family+Transaction+<br/>Category+Dashboard+公共基础设施<br/>~45文件]
    T03[T03: 前端核心UI与页面<br/>shadcn/ui+布局+图表+认证+引导+<br/>仪表盘+交易列表+设置+路由<br/>~50文件]
    T04[T04: 账单导入与AI服务<br/>5平台解析器+AI分类+NLP+<br/>月报生成+导入页面+报告页面<br/>~20文件]
    T05[T05: 实时协同+预算+通知<br/>WebSocket+预算CRUD+心愿目标+<br/>Web Push+邮件+通知中心<br/>~25文件]

    T01 --> T02
    T01 --> T03
    T02 --> T04
    T02 --> T05
    T03 --> T05

    style T01 fill:#4CAF50,color:#fff
    style T02 fill:#2196F3,color:#fff
    style T03 fill:#2196F3,color:#fff
    style T04 fill:#FF9800,color:#fff
    style T05 fill:#FF9800,color:#fff
```

**关键路径**：T01 → T02 → T04 / T05

**并行策略**：
- T01完成后，T02和T03可并行开发（后端/前端独立）
- T02完成后，T04和T05的后端部分可并行
- T03完成后，T05的前端部分可开始
- T04依赖T02（需要AI服务被交易模块调用），但前端导入页面可与T03并行

---

## 6. 依赖包列表

### 6.1 前端依赖（client/package.json）

#### dependencies

```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.26.0",
  "@tanstack/react-query": "^5.51.0",
  "@tanstack/react-table": "^8.20.0",
  "zustand": "^4.5.4",
  "axios": "^1.7.3",
  "socket.io-client": "^4.7.5",
  "echarts": "^5.5.1",
  "echarts-for-react": "^3.0.2",
  "react-hook-form": "^7.52.1",
  "@hookform/resolvers": "^3.9.0",
  "zod": "^3.23.8",
  "date-fns": "^3.6.0",
  "react-hotkeys-hook": "^4.5.0",
  "cmdk": "^1.0.0",
  "lucide-react": "^0.417.0",
  "clsx": "^2.1.1",
  "tailwind-merge": "^2.4.0",
  "class-variance-authority": "^0.7.0",
  "@radix-ui/react-dialog": "^1.1.1",
  "@radix-ui/react-dropdown-menu": "^2.1.1",
  "@radix-ui/react-select": "^2.1.1",
  "@radix-ui/react-tabs": "^1.1.0",
  "@radix-ui/react-toast": "^1.2.1",
  "@radix-ui/react-tooltip": "^1.1.2",
  "@radix-ui/react-popover": "^1.1.1",
  "@radix-ui/react-context-menu": "^2.2.1",
  "@radix-ui/react-checkbox": "^1.1.1",
  "@radix-ui/react-slider": "^1.2.0",
  "@radix-ui/react-progress": "^1.1.0",
  "qrcode.react": "^3.1.0",
  "nanoid": "^5.0.7"
}
```

| 包 | 用途 |
|---|------|
| react / react-dom | UI框架 |
| react-router-dom | 客户端路由 |
| @tanstack/react-query | 服务端状态管理（缓存/同步/失效） |
| @tanstack/react-table | 交易列表表格（排序/筛选/虚拟滚动/行选择） |
| zustand | 客户端状态管理（认证/UI状态） |
| axios | HTTP请求库 |
| socket.io-client | WebSocket实时通信 |
| echarts / echarts-for-react | 图表可视化（仪表盘/趋势/饼图） |
| react-hook-form / @hookform/resolvers / zod | 表单管理与校验 |
| date-fns | 日期处理（格式化/比较/范围） |
| react-hotkeys-hook | 全局快捷键（Ctrl+K等） |
| cmdk | 命令面板UI（快捷记账浮层基础） |
| lucide-react | 图标库 |
| clsx / tailwind-merge / class-variance-authority | className工具（shadcn/ui依赖） |
| @radix-ui/* | 无样式可访问性组件（shadcn/ui底层） |
| qrcode.react | 邀请二维码生成 |
| nanoid | 前端ID生成 |

#### devDependencies

```json
{
  "@types/react": "^18.3.3",
  "@types/react-dom": "^18.3.0",
  "@vitejs/plugin-react": "^4.3.1",
  "vite": "^5.3.5",
  "vite-plugin-pwa": "^0.20.0",
  "typescript": "^5.5.4",
  "tailwindcss": "^3.4.7",
  "postcss": "^8.4.40",
  "autoprefixer": "^10.4.19",
  "eslint": "^8.57.0",
  "@typescript-eslint/eslint-plugin": "^7.18.0",
  "@typescript-eslint/parser": "^7.18.0",
  "eslint-plugin-react-hooks": "^4.6.2",
  "eslint-plugin-react-refresh": "^0.4.9"
}
```

### 6.2 后端依赖（server/package.json）

#### dependencies

```json
{
  "@nestjs/core": "^10.4.0",
  "@nestjs/common": "^10.4.0",
  "@nestjs/platform-express": "^10.4.0",
  "@nestjs/config": "^3.2.3",
  "@nestjs/jwt": "^10.2.0",
  "@nestjs/passport": "^10.0.3",
  "@nestjs/websockets": "^10.4.0",
  "@nestjs/platform-socket.io": "^10.4.0",
  "@nestjs/schedule": "^4.1.0",
  "@nestjs/throttler": "^6.2.1",
  "passport": "^0.7.0",
  "passport-jwt": "^4.0.1",
  "passport-http-bearer": "^1.0.1",
  "prisma": "^5.18.0",
  "@prisma/client": "^5.18.0",
  "class-validator": "^0.14.1",
  "class-transformer": "^0.5.1",
  "bcryptjs": "^2.4.3",
  "socket.io": "^4.7.5",
  "multer": "^1.4.5-lts.1",
  "ali-oss": "^8.17.0",
  "ioredis": "^5.4.1",
  "web-push": "^3.6.7",
  "nodemailer": "^6.9.14",
  "axios": "^1.7.3",
  "pdf-parse": "^1.1.1",
  "iconv-lite": "^0.6.3",
  "csv-parse": "^5.5.6",
  "cheerio": "^1.0.0",
  "nanoid": "^5.0.7",
  "dayjs": "^1.11.12",
  "winston": "^3.13.1",
  "nest-winston": "^1.9.7",
  "helmet": "^7.1.0",
  "cookie-parser": "^1.4.6"
}
```

| 包 | 用途 |
|---|------|
| @nestjs/* | NestJS框架核心模块 |
| @nestjs/jwt + passport-* | JWT认证 |
| @nestjs/websockets + @nestjs/platform-socket.io | WebSocket实时通信 |
| @nestjs/schedule | 定时任务（月报生成/预算检查） |
| @nestjs/throttler | API限流 |
| @prisma/client + prisma | ORM（PostgreSQL） |
| class-validator / class-transformer | DTO验证 |
| bcryptjs | 密码哈希 |
| socket.io | WebSocket服务端 |
| multer | 文件上传处理 |
| ali-oss | 阿里云OSS文件存储 |
| ioredis | Redis客户端（缓存/会话/在线状态） |
| web-push | Web Push推送通知 |
| nodemailer | 邮件发送 |
| axios | HTTP客户端（调用LLM API） |
| pdf-parse | PDF文件文本提取（银行账单） |
| iconv-lite | 编码转换（微信CSV是GBK编码） |
| csv-parse | CSV文件解析 |
| cheerio | HTML解析（支付宝HTML账单） |
| nanoid | ID生成 |
| dayjs | 日期处理 |
| winston / nest-winston | 日志 |
| helmet | HTTP安全头 |
| cookie-parser | Cookie解析 |

#### devDependencies

```json
{
  "@types/node": "^20.14.14",
  "@types/bcryptjs": "^2.4.6",
  "@types/multer": "^1.4.11",
  "@types/passport-jwt": "^4.0.1",
  "@types/web-push": "^3.6.3",
  "@types/nodemailer": "^6.4.15",
  "@types/cookie-parser": "^1.4.7",
  "typescript": "^5.5.4",
  "ts-node": "^10.9.2",
  "tsconfig-paths": "^4.2.0",
  "eslint": "^8.57.0",
  "@typescript-eslint/eslint-plugin": "^7.18.0",
  "@typescript-eslint/parser": "^7.18.0",
  "jest": "^29.7.0",
  "@nestjs/testing": "^10.4.0",
  "supertest": "^7.0.0",
  "@types/jest": "^29.5.12",
  "@types/supertest": "^6.0.2"
}
```

### 6.3 AI相关依赖说明

| 能力 | 依赖 | 说明 |
|------|------|------|
| LLM调用 | axios（后端已有） | 通过HTTP调用通义千问API，无需额外SDK |
| 规则匹配 | 自实现RulesEngine | 基于关键词字典+正则，无额外依赖 |
| NLP解析 | 通义千问Function Calling | LLM API完成自然语言→结构化数据 |
| OCR（P1预留） | 阿里云OCR SDK | P1阶段引入，MVP不需要 |

---

## 7. 共享知识（跨文件约定）

### 7.1 API响应格式约定

**所有API统一返回格式**：

```typescript
// 成功响应
{
  "code": 0,           // 0表示成功
  "data": T,           // 业务数据
  "message": "success" // 描述信息
}

// 失败响应
{
  "code": number,      // 非0错误码
  "data": null,
  "message": string,   // 错误描述
  "errors": [          // 字段级错误（仅验证错误时）
    { "field": "phone", "message": "手机号格式不正确" }
  ]
}
```

**错误码约定**：

| 错误码 | 含义 | HTTP状态码 |
|--------|------|-----------|
| 0 | 成功 | 200 |
| 1001 | 参数验证失败 | 400 |
| 1002 | 资源不存在 | 404 |
| 1003 | 权限不足 | 403 |
| 2001 | 认证失败（Token无效/过期） | 401 |
| 2002 | Refresh Token无效 | 401 |
| 2003 | 账号已被注册 | 409 |
| 2004 | 账号或密码错误 | 401 |
| 3001 | 家庭邀请码无效或已过期 | 400 |
| 3002 | 不是家庭成员 | 403 |
| 3003 | 权限等级不足 | 403 |
| 4001 | 文件格式不支持 | 400 |
| 4002 | 文件大小超限 | 400 |
| 4003 | 账单解析失败 | 422 |
| 5001 | AI服务调用失败 | 503 |
| 9999 | 服务器内部错误 | 500 |

### 7.2 分页约定

```typescript
// 请求参数
{
  "page": 1,          // 页码，从1开始
  "pageSize": 20,     // 每页条数，默认20，最大100
  "sortBy": "date",   // 排序字段
  "sortOrder": "desc" // asc | desc
}

// 响应格式
{
  "code": 0,
  "data": {
    "items": T[],
    "total": 150,
    "page": 1,
    "pageSize": 20,
    "totalPages": 8
  }
}
```

### 7.3 日期时间约定

- **传输格式**：ISO 8601 UTC（如 `2026-07-04T08:30:00.000Z`）
- **存储格式**：PostgreSQL `timestamptz`（UTC存储）
- **展示格式**：前端根据用户时区（Asia/Shanghai）转换为本地时间显示
- **交易日期**：用户选择的是本地日期，存储时转为当天UTC 00:00:00

### 7.4 认证约定

- **Access Token**：JWT，有效期15分钟，通过 `Authorization: Bearer <token>` 头传递
- **Refresh Token**：JWT，有效期7天，存储在HttpOnly Cookie中，防XSS
- **WebSocket认证**：连接时通过 `auth` 参数传递 `{token}`，Gateway验证JWT
- **Token刷新**：前端Axios响应拦截器检测401，自动用Refresh Token刷新后重试原请求
- **并发刷新**：前端使用Promise队列防止多个请求同时触发刷新

### 7.5 前后端类型共享约定

- 后端Prisma schema生成的类型不直接暴露给前端
- 前端在 `src/types/` 下独立定义接口类型（与后端DTO字段对齐）
- API响应中的日期字段统一为ISO 8601字符串
- 金额字段统一为 `number` 类型，单位为「元」（如 28.50），不使用分

### 7.6 WebSocket事件命名约定

- 事件名使用 `模块:动作` 格式（如 `transaction:created`）
- 数据载荷为JSON对象，始终包含操作者 `userId`
- 客户端收到事件后通过 TanStack Query 的 `invalidateQueries` 触发数据刷新
- 断线重连后自动重新加入家庭房间

### 7.7 错误处理约定

**前端**：
- API错误由Axios响应拦截器统一捕获，根据错误码处理
- 401错误自动触发Token刷新或跳转登录页
- 表单验证错误由React Hook Form + Zod在提交前拦截
- 运行时错误由ErrorBoundary组件捕获，显示友好错误页
- 所有用户可见错误通过Toast通知

**后端**：
- 全局异常过滤器 `http-exception.filter.ts` 统一捕获异常
- 业务异常使用NestJS内置HttpException或自定义异常类
- Prisma异常转换为业务错误码（如唯一约束冲突→1003）
- 所有异常记录Winston日志

### 7.8 安全约定

- **密码**：bcrypt哈希，saltRounds=10
- **敏感数据加密**：手机号、邮箱使用AES-256-CBC加密存储，密钥从环境变量读取
- **SQL注入**：Prisma参数化查询，禁止拼接SQL
- **XSS**：React默认转义 + DOMPurify处理用户输入的富文本
- **CSRF**：JWT认证无状态方案天然防CSRF（不依赖Cookie认证）
- **CORS**：仅允许配置的前端域名
- **Helmet**：设置安全HTTP头
- **限流**：登录接口5次/分钟，API整体100次/分钟/用户
- **文件上传**：限制类型（csv/html/pdf）、大小（10MB）、MIME类型校验

### 7.9 环境变量约定

**后端 `.env`**：
```bash
# 应用
NODE_ENV=development
PORT=3001
CLIENT_URL=http://localhost:5173

# 数据库
DATABASE_URL=postgresql://user:pass@localhost:5432/family_finance

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=<random-string>
JWT_REFRESH_SECRET=<random-string>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# AES加密
AES_ENCRYPTION_KEY=<32-byte-hex>

# 阿里云OSS
OSS_REGION=oss-cn-shanghai
OSS_ACCESS_KEY_ID=<key-id>
OSS_ACCESS_KEY_SECRET=<key-secret>
OSS_BUCKET=family-finance-bills

# 通义千问LLM
LLM_API_KEY=<api-key>
LLM_API_URL=https://dashscope.aliyuncs.com/api/v1

# 微信登录
WECHAT_APP_ID=<app-id>
WECHAT_APP_SECRET=<app-secret>

# 邮件
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_USER=<email>
SMTP_PASS=<password>

# Web Push
VAPID_PUBLIC_KEY=<key>
VAPID_PRIVATE_KEY=<key>
VAPID_SUBJECT=mailto:admin@example.com
```

**前端 `.env`**：
```bash
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
VITE_WECHAT_QR_URL=<wechat-qr-api-url>
```

### 7.10 代码规范约定

- **命名**：组件PascalCase，函数/变量camelCase，常量UPPER_SNAKE_CASE，文件名组件用PascalCase，其他用kebab-case
- **TypeScript**：严格模式开启（`strict: true`），禁止 `any`，必须显式声明返回类型
- **React**：函数组件 + Hooks，禁止Class组件；props必须定义interface
- **后端**：NestJS模块化，每个模块包含module/controller/service/dto；service注入PrismaService
- **Git**：Conventional Commits格式（`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`）
- **ESLint**：统一使用 `@typescript-eslint/recommended` + `react-hooks/recommended`

---

## 8. 待明确事项

### 8.1 需进一步确认的技术问题

| 编号 | 问题 | 影响 | 建议 |
|------|------|------|------|
| 1 | **微信扫码登录的微信开放平台资质** | 微信扫码登录需要微信开放平台网站应用（需企业资质+300元认证费） | 建议MVP先用手机号+验证码登录，微信登录在拿到资质后补充 |
| 2 | **短信验证码服务商选择** | 手机号注册/登录需要短信服务 | 建议阿里云短信服务，与部署环境统一；需申请短信签名和模板 |
| 3 | **通义千问API配额与费用** | AI分类和NLP解析大量调用LLM API | 建议先用规则引擎过滤70%+请求，仅未命中的调用LLM；预估月调用量并申请对应配额 |
| 4 | **银行账单PDF格式稳定性** | 招行/工行/建行PDF格式可能随版本变更 | 建议建立格式监控机制，Parser设计为可配置规则；预留人工导入降级方案 |
| 5 | **等保合规要求** | PRD提到数据安全但未明确是否需要等保认证 | MVP阶段暂不做等保认证，但架构设计预留（日志审计/数据加密/访问控制已满足等保二级基本要求） |
| 6 | **PWA离线缓存策略** | 离线时哪些功能可用？离线记账如何同步？ | 建议：离线仅可查看已缓存数据；记账操作需要在线（NLP解析依赖后端）；PWA缓存策略为App Shell + API缓存 |

### 8.2 架构假设

1. **假设7人团队**：前端2人、后端2人、AI/算法1人、设计1人、测试1人。如果团队规模不同，任务分配需调整。
2. **假设支付宝/微信账单导出格式在开发期间不变**：如遇格式变更需更新Parser。
3. **假设通义千问API稳定可用**：如API不可用需降级为纯规则分类。
4. **假设MVP阶段用户量<1万**：单实例PostgreSQL + Redis足够；后续需考虑读写分离。
5. **假设单家庭成员数≤6人**：WebSocket房间广播性能在此范围内无瓶颈。

### 8.3 后续迭代预留

| 预留点 | 位置 | 说明 |
|--------|------|------|
| 语音记账（P2） | `TransactionSource.VOICE`枚举已预留 | 前端Web Speech API + 后端NLP复用 |
| AI对话顾问（P2） | AI模块预留 `ai.controller.ts` 端点 | LLM + RAG架构后续扩展 |
| OCR票据识别（P1） | Import模块Parser接口可扩展 | 新增 `receipt.parser.ts` |
| 消费行为画像（P1） | Dashboard模块可扩展 | 新增 `profile.service.ts` |
| 数据导出中心（P1） | `lib/excelExport.ts` 已含基础导出 | 后续扩展PDF/自定义字段 |
| 多币种支持（P2） | Transaction模型可扩展 `currency` 字段 | Prisma schema预留 |
| 深色模式（P2） | Tailwind CSS dark mode 已配置 | `uiStore` 预留 `theme` 状态 |
| Elasticsearch（后续） | 搜索接口抽象在 `transaction.service.ts` | 数据量增大后替换实现 |

---

## 附录：文档产出文件

| 文件 | 路径 |
|------|------|
| 架构设计文档 | `docs/architecture/architecture-design-web-2026-07-04.md` |
| 类图（Mermaid） | `docs/architecture/class-diagram.mermaid` |
| 时序图（Mermaid） | `docs/architecture/sequence-diagram.mermaid` |

---

> 本文档由架构师高见远（Gao）基于需求确认文档和PRD撰写，供工程团队执行实施。

# AI驱动的家庭记账与财务规划Web应用

## 项目简介

一款以Web应用为核心的AI驱动家庭记账与财务规划工具。支持多平台账单导入（支付宝/微信/银行）、AI自动分类、家庭协同记账、智能预算管理、AI财务洞察月报等功能。

## 技术栈

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **UI**: shadcn/ui + Tailwind CSS 3
- **状态管理**: Zustand（客户端） + TanStack Query v5（服务端）
- **图表**: ECharts 5
- **实时通信**: Socket.IO Client
- **PWA**: vite-plugin-pwa

### 后端
- **框架**: NestJS 10 + TypeScript
- **ORM**: Prisma 5
- **数据库**: PostgreSQL 16（含pgvector扩展）
- **缓存**: Redis 7
- **认证**: JWT双Token（Access 15min + Refresh 7天 HttpOnly Cookie）
- **实时通信**: Socket.IO（NestJS Gateway）
- **事件总线**: @nestjs/event-emitter

## 项目结构

```
家庭财务软件开发/
├── frontend/          # 前端项目（React + Vite）
├── backend/           # 后端项目（NestJS + Prisma）
├── docker-compose.yml         # 完整环境编排
├── docker-compose.dev.yml     # 开发环境（仅DB+Redis）
├── .env.example      # 环境变量模板
└── .gitignore
```

## 快速开始

### 1. 环境准备

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16（或使用Docker）
- Redis 7（或使用Docker）

### 2. 启动数据库和缓存（开发环境）

```bash
# 复制环境变量模板
cp .env.example .env

# 启动 PostgreSQL + Redis
docker-compose -f docker-compose.dev.yml up -d
```

### 3. 启动后端

```bash
cd backend

# 安装依赖
npm install

# 复制环境变量
cp .env.example .env

# 生成 Prisma Client
npx prisma generate

# 执行数据库迁移
npx prisma db push

# 执行种子数据
npm run seed

# 启动开发服务器
npm run start:dev
```

后端运行在 http://localhost:3001

### 4. 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端运行在 http://localhost:5173

## API响应格式约定

```typescript
// 成功响应
{ "code": 0, "data": T, "message": "success" }

// 失败响应
{ "code": number, "data": null, "message": string, "errors": [...] }
```

## 关键设计决策

- **金额单位**: 元（非分），decimal类型
- **日期格式**: ISO 8601 UTC传输
- **认证**: JWT双Token，Access放Authorization header，Refresh放HttpOnly Cookie
- **事件总线**: @nestjs/event-emitter实现跨模块解耦
- **LLM Provider**: ILLMProvider接口抽象，支持通义千问/DeepSeek/文心一言切换
- **扩展预留**: Transaction表含currency/metadata/tags字段

## 许可证

MIT

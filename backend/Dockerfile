# ==================== 后端 Dockerfile ====================
# 多阶段构建：编译TypeScript → 运行Node.js

# 阶段1：构建
FROM node:20-alpine3.18 AS builder

WORKDIR /app

# 复制package文件
COPY package*.json ./
COPY prisma ./prisma/

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 生成Prisma Client
RUN npx prisma generate

# 编译TypeScript
RUN npm run build

# 阶段2：运行
FROM node:20-alpine3.18 AS runner

WORKDIR /app

# 安装 dumb-init + nc（用于entrypoint中检测数据库就绪）
# openssl1.1-compat 提供 libssl.so.1.1 / libcrypto.so.1.1，供 Prisma 5.22 musl 引擎加载
RUN apk add --no-cache dumb-init netcat-openbsd openssl1.1-compat

# 复制package文件
COPY package*.json ./
COPY prisma ./prisma/

# 仅安装生产依赖
RUN npm ci --only=production && npm cache clean --force

# 复制构建产物
COPY --from=builder /app/dist ./dist

# 生成Prisma Client（运行时需要）
RUN npx prisma generate

# 复制启动脚本
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

# 创建上传目录
RUN mkdir -p uploads

# 暴露端口
EXPOSE 3001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# 启动命令
CMD ["dumb-init", "sh", "./entrypoint.sh"]

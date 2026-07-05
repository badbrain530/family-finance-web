# 家庭财务管理系统 - 腾讯云轻量服务器 Docker 部署指南

## 架构概览

```
用户浏览器 → [轻量服务器公网IP:80]
                    ↓
              ┌─────────────────┐
              │  Nginx (前端容器) │  ← 静态文件 + SPA路由
              │  端口: 80        │
              └────┬───────┬────┘
            /api/  │       │  /socket.io/
                   ↓       ↓
              ┌─────────────────┐
              │  NestJS后端容器  │  ← API + WebSocket
              │  端口: 3001     │
              └──┬──────────┬──┘
                 ↓          ↓
         ┌──────────┐  ┌─────────┐
         │ PostgreSQL│  │  Redis  │
         │ 端口:5432 │  │ 端口:6379│
         └──────────┘  └─────────┘
```

所有数据库/Redis端口仅绑定 127.0.0.1，外网无法直接访问。

---

## 前置准备

### 1. 购买腾讯云轻量服务器

- **推荐配置**：2核4G 6M（最低1核2G也可跑，但构建时可能较慢）
- **操作系统**：Ubuntu 22.04 LTS（推荐）
- **地域**：选择离你最近的（如上海、广州）

### 2. 安全组 / 防火墙规则

在轻量服务器控制台 → 防火墙，开放以下端口：

| 端口 | 用途 | 来源 |
|------|------|------|
| 22 | SSH 登录 | 你的IP（或 0.0.0.0/0） |
| 80 | HTTP 网站访问 | 0.0.0.0/0 |
| 443 | HTTPS（可选，配域名后） | 0.0.0.0/0 |

> ⚠️ **不要开放** 5432（PostgreSQL）和 6379（Redis）端口，它们已在 docker-compose 中绑定 127.0.0.1。

---

## 部署步骤

### 第一步：SSH 连接服务器

```bash
ssh root@你的服务器公网IP
```

### 第二步：安装 Docker + Docker Compose

```bash
# 更新系统
apt update && apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | bash

# 验证安装
docker --version
docker compose version
```

> 国内服务器如果下载慢，可使用腾讯云镜像：
> ```bash
> curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
> ```

### 第三步：安装 Git 并克隆代码

```bash
apt install -y git

# 克隆你的 Gitee 仓库
git clone https://gitee.com/bad_brain/family-finance-web.git /opt/family-finance

cd /opt/family-finance
```

### 第四步：配置环境变量

```bash
# 从模板创建 .env
cp .env.production.example .env

# 编辑配置
nano .env
```

**必须修改的项**（搜索 `!!!` 标记）：

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `DB_PASSWORD` | 数据库密码 | 生成随机16位字符串 |
| `JWT_ACCESS_SECRET` | JWT访问密钥 | 生成随机32位字符串 |
| `JWT_REFRESH_SECRET` | JWT刷新密钥 | 生成随机32位字符串 |
| `CRYPTO_SECRET_KEY` | AES加密密钥 | 生成随机32位字符串 |
| `LLM_API_KEY` | 通义千问API Key | 从阿里云控制台获取 |
| `CORS_ORIGINS` | 允许的跨域来源 | `http://你的服务器IP` |

**生成随机密钥的方法**：
```bash
openssl rand -hex 16   # 生成32位十六进制字符串
openssl rand -base64 24 # 生成24位Base64字符串
```

> **MVP阶段可以留空的项**（不影响核心功能）：
> - `OSS_*` — 文件存本地，不传OSS
> - `WECHAT_*` — 微信登录暂不用
> - `WEB_PUSH_*` — 推送通知暂不用
> - `SMTP_*` — 邮件通知暂不用

### 第五步：构建并启动

```bash
# 构建镜像 + 启动所有服务（首次约5-10分钟）
docker compose up -d --build

# 查看启动状态
docker compose ps

# 查看后端日志（确认数据库迁移和启动成功）
docker compose logs -f backend
```

**预期输出**：
```
family_finance_pg       healthy
family_finance_redis    healthy
family_finance_backend  Up
family_finance_frontend Up
```

后端日志应显示：
```
=== Family Finance Backend Starting ===
[1/3] Waiting for PostgreSQL...
  PostgreSQL is ready.
[2/3] Running prisma db push...
  Database schema synced.
[3/3] Starting NestJS application...
Nest application successfully started
```

### 第六步：验证部署

```bash
# 测试API健康检查
curl http://localhost:3001/api/health

# 测试前端页面
curl -I http://localhost:80
```

浏览器访问 `http://你的服务器公网IP`，应看到登录页面。

---

## 日常运维命令

```bash
cd /opt/family-finance

# 查看所有服务状态
docker compose ps

# 查看实时日志
docker compose logs -f              # 所有服务
docker compose logs -f backend      # 仅后端
docker compose logs -f frontend     # 仅前端

# 重启某个服务
docker compose restart backend
docker compose restart frontend

# 停止所有服务
docker compose down

# 停止并删除数据卷（⚠️ 清空数据库，谨慎使用！）
docker compose down -v

# 更新代码后重新部署
git pull origin main
docker compose up -d --build
```

---

## 可选：配置域名 + HTTPS

### 1. 域名解析

在域名服务商处添加 A 记录：
- 主机记录：`finance`（或 `@`）
- 记录类型：A
- 记录值：你的服务器公网IP

### 2. 修改 .env

```bash
# 编辑 .env，修改 CORS
CORS_ORIGINS=https://finance.yourdomain.com

# 前端API地址改为相对路径（Nginx反代）
VITE_API_BASE_URL=/api
VITE_WS_URL=
```

### 3. 配置 Nginx 反向代理 + SSL

```bash
# 安装 Nginx 和 Certbot
apt install -y nginx certbot python3-certbot-nginx

# 创建反向代理配置
cat > /etc/nginx/conf.d/finance.conf << 'EOF'
server {
    listen 80;
    server_name finance.yourdomain.com;  # 改为你的域名

    client_max_body_size 50M;  # 账单文件上传

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# 重新加载 Nginx
nginx -t && systemctl reload nginx

# 申请SSL证书（自动配置HTTPS）
certbot --nginx -d finance.yourdomain.com
```

### 4. 修改 docker-compose 端口映射

如果使用宿主机Nginx反代，修改 `docker-compose.yml` 中前端端口：

```yaml
  frontend:
    ports:
      - "127.0.0.1:8080:80"  # 只监听本地，由宿主机Nginx反代
```

然后 `docker compose up -d` 重启。

---

## 常见问题排查

### Q: 后端启动失败，日志显示 "Waiting for PostgreSQL..."

```bash
# 检查PostgreSQL容器状态
docker compose logs postgres

# 确认密码与.env中DB_PASSWORD一致
# 如果不一致：docker compose down -v && docker compose up -d --build
```

### Q: 前端页面白屏 / API 404

```bash
# 检查Nginx是否正常
docker compose logs frontend

# 确认VITE_API_BASE_URL配置
# 如果使用IP访问，应为 /api（Nginx反代）
# 如果前端直接调后端，应为 http://服务器IP:3001/api
```

### Q: 构建时 npm install 很慢

在 `backend/Dockerfile` 和 `frontend/Dockerfile` 的 `npm ci` 前添加淘宝镜像：

```dockerfile
RUN npm config set registry https://registry.npmmirror.com && npm ci
```

### Q: 磁盘空间不足

```bash
# 清理Docker无用镜像和缓存
docker system prune -a --volumes

# 查看磁盘使用
df -h
docker system df
```

### Q: 数据库备份

```bash
# 手动备份
docker compose exec postgres pg_dump -U family_finance family_finance > backup_$(date +%Y%m%d).sql

# 恢复备份
docker compose exec -T postgres psql -U family_finance family_finance < backup_20260705.sql

# 设置定时备份（每天凌晨3点）
echo "0 3 * * * cd /opt/family-finance && docker compose exec -T postgres pg_dump -U family_finance family_finance > /opt/backups/finance_$(date +\%Y\%m\%d).sql" | crontab -
```

---

## 资源占用参考

| 组件 | 内存 | CPU |
|------|------|-----|
| PostgreSQL | ~100MB | 低 |
| Redis | ~30MB | 极低 |
| NestJS后端 | ~150MB | 中 |
| Nginx前端 | ~10MB | 极低 |
| **合计** | **~300MB** | **1核足够** |

2核4G配置完全可以流畅运行，1核2G也能跑但构建时较慢。

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

> 说明：本项目 HTTPS 由**前端容器内的 Nginx** 直接承载（已在 `frontend/nginx.conf` 写好 80→443 跳转与 443 监听），证书放在宿主机项目内的 `ssl/` 目录，由 `docker-compose.yml` 以只读方式挂载到容器内的 `/etc/nginx/ssl`。因此**不需要**在宿主机再装 Nginx 做反代，也**不要**改动 `docker-compose.yml` 与 `frontend/nginx.conf`。

### 1. 前提条件

- 域名 `family-finance.cloud`（含 `www.family-finance.cloud`）已通过 A 记录解析到本服务器公网 IP；
- 腾讯云轻量服务器防火墙 / 安全组已开放 `80` 与 `443`（certbot 校验与 HTTPS 访问都需要）；
- 服务器已安装 `certbot` 与 `docker` / `docker compose`（见上文部署步骤）。

### 2. 申请证书（二选一）

#### A. Let's Encrypt 自动申请（推荐）

在项目根目录执行脚本即可，证书会自动签发到 `ssl/live/family-finance.cloud/`：

```bash
# 在项目根目录（docker-compose.yml 所在目录）执行
bash deploy/init-ssl.sh
```

脚本会自动：
- 检查 `certbot`、`docker`、`docker compose` 是否就绪；
- 若 frontend 容器正在运行（占用 80 端口），先临时 `stop frontend` 释放 80 端口，申请完成后再 `start frontend` 恢复；
- 用 `certbot certonly --standalone` 把证书写到 `ssl/live/family-finance.cloud/{fullchain.pem,privkey.pem}`；
- 支持续期：执行 `bash deploy/init-ssl.sh renew`（见第 6 节）。

#### B. 腾讯云 / 其它厂商免费证书

1. 在证书控制台申请 Nginx 格式证书并下载；
2. 将证书文件按如下命名放入 `ssl/live/family-finance.cloud/` 目录（没有该目录则新建）：
   - 证书文件重命名为 `fullchain.pem`
   - 私钥文件重命名为 `privkey.pem`

```bash
mkdir -p ssl/live/family-finance.cloud
# 把下载的证书 / 私钥拷贝进来并改名
cp 你的证书.pem ssl/live/family-finance.cloud/fullchain.pem
cp 你的私钥.key ssl/live/family-finance.cloud/privkey.pem
```

### 3. 不要改动 docker-compose / nginx.conf

容器内 Nginx 已监听 `443` 并引用 `/etc/nginx/ssl/live/family-finance.cloud/` 路径。只要宿主机项目内的 `ssl/` 目录存在证书、且 `docker-compose.yml` 已挂载它（已配好，无需改动），前端容器启动后即可使用 HTTPS。

### 4. 配置 .env

编辑 `.env`，把跨域来源改为 HTTPS 域名（多个用逗号分隔），前端 API 地址保持 `/api` 走 Nginx 反代：

```bash
# 编辑 .env
CORS_ORIGINS=https://family-finance.cloud
VITE_API_BASE_URL=/api   # 保持不变
```

> 提示：`VITE_API_BASE_URL` 必须是 `/api`（相对路径，由容器内 Nginx 反代到后端），不能写成 `http://...`。

### 5. 启动 / 访问顺序

```bash
# 1) 从模板创建 .env（若尚未创建）
cp .env.production.example .env

# 2) 按需修改 .env 中的密钥、CORS_ORIGINS 等

# 3) 申请证书（此时 80 端口需空闲，脚本会自动处理冲突）
bash deploy/init-ssl.sh

# 4) 构建并启动全部服务
docker compose up -d --build
```

访问 `https://family-finance.cloud`，浏览器访问 `http://family-finance.cloud` 会自动 301 跳转到 HTTPS。

若 frontend 已在运行、仅需重新加载新证书，可执行：

```bash
docker compose restart frontend
```

### 6. 证书自动续期（Let's Encrypt）

Let's Encrypt 证书有效期 90 天。建议加入系统 cron 自动续期（脚本 `renew` 模式会先停 frontend 释放 80 端口，续期后自动恢复）：

```bash
# 编辑 root 的定时任务
crontab -e
# 加入下行（每天 0 点、12 点各检查一次，到期自动续期）：
0 0,12 * * * root bash /opt/family-finance/deploy/init-ssl.sh renew >> /var/log/ssl-renew.log 2>&1
```

> 提示：若你是其他路径部署（非 `/opt/family-finance`），请将上面路径替换为实际的 `deploy/init-ssl.sh` 绝对路径。

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

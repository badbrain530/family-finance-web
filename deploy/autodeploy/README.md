# 家庭财务 · 自动部署接收器（Gitee Push WebHook → 自动 pull + build）

本目录 `deploy/autodeploy/` 提供一套**零 npm 依赖**的轻量 WebHook 接收器。
配置好之后，你把代码 push 到 Gitee 的 `main` 分支，Gitee 会打一个 HTTP 请求到服务器，
接收器自动执行 `git pull` + `docker compose up -d --build`，实现**自动部署**，
不再需要每次 SSH 手动操作。

> 本接收器是**独立服务**，只新增一个 `deployer` 容器，**不修改**现有的 `docker-compose.yml`、
> 后端/前端代码。暂停自动部署只需 `down` 掉它即可，手动部署完全不受影响。

---

## 一、前置条件

- 服务器（腾讯云轻量）上 `/opt/family-finance` 已经用 **HTTPS** 方式 clone 好仓库。
- 服务器已安装 `docker` 与 `docker compose`（v2，即 `docker compose` 子命令）。
- 服务器能访问 Gitee（`git pull` 与接收 Gitee 公网回调都需要）。

---

## 二、准备 git HTTPS 凭据（关键）

接收器容器内的 `git pull` 需要免交互认证。我们让服务器生成一次凭据文件，
再把它**只读挂载**进容器（`/root/.git-credentials`）。

在**服务器**上执行：

```bash
# 1) 启用凭据存储（明文落盘到 ~/.git-credentials）
git config --global credential.helper store

# 2) 手动 pull 一次，按提示输入 Gitee 账号 和 私人令牌(PAT)
cd /opt/family-finance
git pull origin main
# 用户名：你的 Gitee 账号
# 密码：Gitee 私人令牌（PAT，不是登录密码）
#      生成位置：Gitee 右上角头像 → 设置 → 安全设置 → 私人令牌
```

执行成功后，`~/.git-credentials` 已落盘，内容形如：

```
https://<账号>:<PAT>@gitee.com/.../family-finance.git
```

> 接收器容器以 root 运行，挂载路径 `/root/.git-credentials:ro` 正好对应。
> 后续容器内 `git pull` 会自动读取该文件，无需再输密码。

---

## 三、生成强随机 WEBHOOK_TOKEN

在**服务器**上：

```bash
openssl rand -hex 32
```

把输出保存好，下一步要用，也用于 Gitee WebHook 的「密钥/密码」。

> 务必使用强随机值，不要用弱口令。此 token 是接收器的唯一鉴权手段。

---

## 四、启动接收器

`WEBHOOK_TOKEN` 是**必填**项。下面三种方式任选其一（推荐方式 1，持久且不易踩坑）。

> ⚠️ **重要路径坑**：用 `docker compose -f deploy/autodeploy/docker-compose.autodeploy.yml` 启动时，
> Compose 的「项目目录」取的是 **compose 文件所在目录**（`deploy/autodeploy/`），
> 它自动读取的 `.env` 是 `deploy/autodeploy/.env`，**不是**仓库根的 `/opt/family-finance/.env`。
> 所以把 token 写进仓库根 `.env` 而**不带 `--env-file`** 是读不到的，会报
> `required variable WEBHOOK_TOKEN is missing a value`。

**方式 1（推荐，持久化）**：token 写进仓库根 `.env`，启动显式指定 env 文件
```bash
cd /opt/family-finance
# 生成强随机 token 并写入根 .env（若已存在则覆盖该行）
TOKEN=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc a-f0-9 | head -c 64)
grep -q '^WEBHOOK_TOKEN=' .env && sed -i "s#^WEBHOOK_TOKEN=.*#WEBHOOK_TOKEN=$TOKEN#" .env || echo "WEBHOOK_TOKEN=$TOKEN" >> .env

# 关键：用 --env-file 显式指向根 .env，绕开上面的路径坑
docker compose --env-file /opt/family-finance/.env -f deploy/autodeploy/docker-compose.autodeploy.yml up -d --build
```

**方式 2（行内变量，临时/测试）**：直接在命令前注入环境变量（compose 继承环境变量，能读到）
```bash
cd /opt/family-finance
WEBHOOK_TOKEN=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc a-f0-9 | head -c 64) \
  docker compose -f deploy/autodeploy/docker-compose.autodeploy.yml up -d --build
```
> 注意：行内变量只管当前 shell，服务器重启后 deployer 重启会再次缺变量；长期使用请改用方式 1。

**方式 3（写到 compose 项目目录的 `.env`）**：
```bash
cd /opt/family-finance
echo "WEBHOOK_TOKEN=$(openssl rand -hex 32 2>/dev/null || cat /dev/urandom | tr -dc a-f0-9 | head -c 64)" >> deploy/autodeploy/.env
docker compose -f deploy/autodeploy/docker-compose.autodeploy.yml up -d --build
```
> 注意：`deploy/autodeploy/.env` 在仓库内，确保 `.gitignore` 忽略它（根 `.env` 同理），勿提交进 git。

说明：

- 这条命令**只构建并启动 `deployer`**，不碰现有 frontend / backend。
- 容器监听 `9000` 端口（宿主机 `9000:9000`）。
- 查看日志：`docker compose -f deploy/autodeploy/docker-compose.autodeploy.yml logs -f deployer`

---

## 五、配置 Gitee WebHook

在 Gitee 仓库页面：

1. 进入 **管理 → WebHooks → 添加 WebHook**。
2. URL：`http://<服务器公网IP>:9000/webhook`
3. 内容类型：**application/json**
4. 密钥 / 密码：填写上面生成的 `WEBHOOK_TOKEN`
   （Gitee 会把它放到请求头 `X-Gitee-Token`，接收器据此鉴权）
5. 触发事件：**只勾 Push**（取消其它所有事件）
6. 保存。

保存后点击 **「测试」**，Gitee 会发一个模拟 push 事件。接收器应返回 **200**。
（测试事件的 `ref` 可能不是 `refs/heads/main`，若返回 `ignored` 也属正常，只要不是 401/500 即可。）

---

## 六、安全提醒

- **开放端口**：Gitee 回调来自公网，需在轻量服务器**防火墙 / 安全组**开放 `9000` 到公网。
- **强 token 必填**：`WEBHOOK_TOKEN` 缺失时接收器会拒绝所有请求（401），请务必配置。
- **进阶加固（可选）**：
  - 用防火墙限制仅允许 Gitee 出口 IP 段访问 9000；
  - 或前置 **Nginx + HTTPS + 基础 auth** 再做一层保护（一句话提示，按需自行配置）。

---

## 七、验证自动部署

1. 本地修改代码，push 到 `main`：
   ```bash
   git push origin main
   ```
2. 看接收器日志，应有 `git pull` + `docker compose build/up` 日志：
   ```bash
   docker compose -f deploy/autodeploy/docker-compose.autodeploy.yml logs -f deployer
   ```
   正常结尾应打印 `自动部署成功`，请求返回 `{"status":"ok"}`。
3. 确认 frontend / backend 已重建：
   ```bash
   docker compose ps
   ```

---

## 八、排错

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 返回 **401** | `WEBHOOK_TOKEN` 不一致或未配置 | 确认 Gitee 密钥与服务器环境变量完全一致；确认服务器已设置 `WEBHOOK_TOKEN` |
| `git pull` 失败 / 日志报认证错误 | `~/.git-credentials` 没挂好或 PAT 失效 | 重做「二、准备 git 凭据」；确认 compose 中 `~/.git-credentials:/root/.git-credentials:ro` 挂载存在 |
| `docker` 失败 / 找不到 daemon | `docker.sock` 没挂或路径错 | 确认 compose 中 `/var/run/docker.sock:/var/run/docker.sock` 已挂载；宿主机 `docker ps` 正常 |
| 返回 `{"status":"skipped","reason":"already running"}` | 上一次部署还在跑 | 正常并发保护，无需处理；若长时间不恢复查看日志是否卡住 |
| 非 main 分支 push 返回 `ignored` | 分支白名单 | 正常，只有 `main` 分支才触发 build |

---

## 九、回滚 / 暂停自动部署

不想自动部署时，只停接收器即可，**手动部署不受影响**：

```bash
docker compose -f deploy/autodeploy/docker-compose.autodeploy.yml down
```

之后照旧手动：

```bash
cd /opt/family-finance
git pull origin main
docker compose up -d --build
```

---

## 十、文件清单

| 文件 | 职责 |
|------|------|
| `server.js` | Node 20 原生 http 实现的 WebHook 接收器（零依赖） |
| `package.json` | 仅含 `start` 脚本，无 dependencies |
| `Dockerfile` | 基于 `node:20-alpine`，装 `docker-cli git openssh-client` |
| `docker-compose.autodeploy.yml` | 定义独立 `deployer` 服务与挂载（docker.sock / 仓库 / git 凭据） |
| `README.md` | 本运维文档 |

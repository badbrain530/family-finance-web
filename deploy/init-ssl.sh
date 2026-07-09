#!/usr/bin/env bash
#
# deploy/init-ssl.sh
# -----------------------------------------------------------------------------
# 申请 / 续期 Let's Encrypt 证书，并把证书签发到项目内的 ssl/ 目录。
#
# 设计依据（与现有部署架构一致，请勿改动 docker-compose.yml / frontend/nginx.conf）：
#   - docker-compose.yml 中 frontend 服务挂载：./ssl:/etc/nginx/ssl:ro
#   - frontend/nginx.conf 中 443 server block 引用：
#        /etc/nginx/ssl/live/family-finance.cloud/fullchain.pem
#        /etc/nginx/ssl/live/family-finance.cloud/privkey.pem
#   => 本脚本用 certbot 的 --config-dir ./ssl，使证书落到
#      <项目根>/ssl/live/<DOMAIN>/{fullchain.pem,privkey.pem}，
#      挂载后正好对应容器内 nginx.conf 期望的路径。
# -----------------------------------------------------------------------------

set -euo pipefail

# ========================= 可配置变量（允许环境变量覆盖） =========================
DOMAIN=${DOMAIN:-family-finance.cloud}
DOMAIN_WWW=${DOMAIN_WWW:-www.family-finance.cloud}
CERT_EMAIL=${CERT_EMAIL:-admin@family-finance.cloud}

# 脚本位于 deploy/ 目录，上一级即项目根目录（docker-compose.yml 所在目录）
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"

# 切换到项目根目录，确保 docker compose 的相对路径（如 ./ssl）解析正确
cd "$PROJECT_DIR"

# 标记 frontend 是否在申请前处于运行状态（用于结束后恢复）
FRONTEND_WAS_RUNNING=0

# ========================= 通用函数 =========================
log()  { echo "==> $*"; }
warn() { echo "!!  $*"; }

# 检测 frontend 容器是否处于 running 状态
frontend_is_running() {
  docker compose -f "$COMPOSE_FILE" ps --status running frontend 2>/dev/null \
    | grep -q "running"
}

# 申请证书前，若 frontend 正在运行则临时停止以释放 80 端口
# （certbot standalone 模式需要独占 80 端口完成 HTTP-01 校验）
release_port_80() {
  if frontend_is_running; then
    log "检测到 frontend 正在运行，临时停止以释放 80 端口 ..."
    docker compose -f "$COMPOSE_FILE" stop frontend
    FRONTEND_WAS_RUNNING=1
  else
    log "frontend 未运行，80 端口当前空闲，无需处理。"
    FRONTEND_WAS_RUNNING=0
  fi
}

# 无论申请成功或失败，都恢复 frontend 容器（通过 trap 调用）
restore_frontend() {
  if [ "$FRONTEND_WAS_RUNNING" = "1" ]; then
    log "恢复 frontend 容器 ..."
    docker compose -f "$COMPOSE_FILE" start frontend || true
  fi
}

# 前置依赖检查
check_prerequisites() {
  log "检查 certbot 是否已安装 ..."
  if ! command -v certbot >/dev/null 2>&1; then
    warn "未检测到 certbot，请先在服务器上安装："
    echo "      apt update && apt install -y certbot"
    exit 1
  fi
  log "certbot 已安装：$(certbot --version 2>&1 | head -n1)"

  log "检查 docker 是否可用 ..."
  if ! command -v docker >/dev/null 2>&1; then
    warn "未检测到 docker，请先安装 Docker。"
    exit 1
  fi

  log "检查 docker compose 是否可用 ..."
  if ! docker compose version >/dev/null 2>&1; then
    warn "未检测到 docker compose 插件（v2），请安装 Docker Compose v2。"
    exit 1
  fi
  log "docker / docker compose 就绪。"
}

# ========================= 模式：申请证书（默认） =========================
issue_certificate() {
  log "开始为域名 $DOMAIN / $DOMAIN_WWW 申请证书 ..."
  release_port_80

  certbot certonly --standalone \
    --config-dir "$PROJECT_DIR/ssl" \
    --work-dir "$PROJECT_DIR/ssl-work" \
    --logs-dir "$PROJECT_DIR/ssl-logs" \
    --non-interactive --agree-tos -m "$CERT_EMAIL" \
    -d "$DOMAIN" -d "$DOMAIN_WWW"

  log "证书申请完成，已落到：$PROJECT_DIR/ssl/live/$DOMAIN/"
}

# ========================= 模式：续期（renew） =========================
renew_certificate() {
  log "执行证书续期（renew）..."
  # certbot renew 会通过 pre/post-hook 自动管理 frontend 的 80 端口占用
  certbot renew \
    --config-dir "$PROJECT_DIR/ssl" \
    --work-dir "$PROJECT_DIR/ssl-work" \
    --logs-dir "$PROJECT_DIR/ssl-logs" \
    --pre-hook  "docker compose -f $PROJECT_DIR/docker-compose.yml stop frontend" \
    --post-hook "docker compose -f $PROJECT_DIR/docker-compose.yml start frontend"

  log "续期流程结束。若证书已更新，仍位于：$PROJECT_DIR/ssl/live/$DOMAIN/"
  warn "若 frontend 正在运行，建议执行 'docker compose restart frontend' 以加载新证书。"
}

# ========================= 主流程 =========================
main() {
  # 注册退出钩子：无论成功或失败都尝试恢复 frontend（仅申请模式会真正停止它）
  trap restore_frontend EXIT

  check_prerequisites

  case "${1:-}" in
    renew)
      renew_certificate
      ;;
    ""|issue)
      issue_certificate
      ;;
    *)
      warn "未知参数：$1"
      echo "用法：bash deploy/init-ssl.sh [issue|renew]"
      echo "  issue  （默认）申请证书"
      echo "  renew            续期已有证书（建议加入 cron）"
      exit 1
      ;;
  esac

  # 成功提示
  echo
  log "=========================================================="
  log "证书已就绪：$PROJECT_DIR/ssl/live/$DOMAIN/"
  log "包含文件：fullchain.pem  privkey.pem"
  if [ "$FRONTEND_WAS_RUNNING" = "1" ]; then
    log "frontend 已自动恢复运行，证书可直接加载。"
  else
    log "现在可以启动全部服务：docker compose up -d --build"
    log "若服务已在运行，则执行：docker compose restart frontend 以重载证书"
  fi
  log "----------------------------------------------------------"
  warn "Let's Encrypt 证书有效期 90 天，建议加入 cron 自动续期："
  echo "  0 0,12 * * * root bash $PROJECT_DIR/deploy/init-ssl.sh renew >> /var/log/ssl-renew.log 2>&1"
  log "=========================================================="
  echo
}

main "$@"

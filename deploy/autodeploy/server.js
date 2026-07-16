'use strict';

/**
 * family-finance-autodeploy
 * 零依赖 Gitee Push WebHook 接收器。
 * 收到 main 分支的 push 事件后，自动在宿主机执行：
 *   1) git pull origin main
 *   2) docker compose up -d --build
 * 容器通过挂载宿主机的 /var/run/docker.sock 操作宿主机 docker。
 */

const http = require('http');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileP = promisify(execFile);

// ----------------------- 配置 -----------------------
const PORT = parseInt(process.env.PORT, 10) || 9000;
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || '';
const REPO_DIR = process.env.REPO_DIR || '/app/repo';
const COMPOSE_FILE = `${REPO_DIR}/docker-compose.yml`;

// 1MB 上限，防止恶意超大 body 撑爆内存
const MAX_BODY_BYTES = 1024 * 1024;

// 并发保护：上一次部署还在跑时，新请求直接跳过
let deploying = false;

// ----------------------- 结构化日志（UTC） -----------------------
function log(level, msg, meta) {
  const entry = {
    time: new Date().toISOString(), // UTC
    level,
    msg,
  };
  if (meta !== undefined) entry.meta = meta;
  process.stdout.write(JSON.stringify(entry) + '\n');
}

// 只保留 ASCII 可见字符的 token 做模糊打印（避免泄露完整密钥）
function maskToken(t) {
  if (!t) return '(empty)';
  return t.length <= 8 ? '****' : t.slice(0, 4) + '****' + t.slice(-4);
}

// ----------------------- HTTP 辅助 -----------------------
function sendJson(res, statusCode, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (c) => {
      total += c.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ----------------------- 鉴权 -----------------------
// 优先级：X-Gitee-Token 头；兜底：body.password 字段。
function isAuthorized(req, bodyObj) {
  if (!WEBHOOK_TOKEN) {
    // 未配置 token 视为未授权，强制要求配置
    return false;
  }
  const headerToken = req.headers['x-gitee-token'];
  if (typeof headerToken === 'string' && headerToken === WEBHOOK_TOKEN) {
    return true;
  }
  const bodyToken = bodyObj && bodyObj.password;
  if (typeof bodyToken === 'string' && bodyToken === WEBHOOK_TOKEN) {
    return true;
  }
  return false;
}

// ----------------------- 部署执行 -----------------------
// 关键安全点：命令参数全部来自可信环境变量（REPO_DIR），不使用任何请求可控输入。
// ref 分支名只做「相等比较」，绝不拼进 shell。这里用 execFile + 参数数组，
// 从根本上杜绝命令注入。
async function runDeploy() {
  log('info', 'git pull 开始', { repo: REPO_DIR });
  const gitRes = await execFileP('git', ['-C', REPO_DIR, 'pull', 'origin', 'main'], {
    timeout: 180000,
  });
  log('info', 'git pull 完成', { stdout: (gitRes.stdout || '').slice(0, 500) });

  log('info', 'docker compose build/up 开始', { compose: COMPOSE_FILE });
  const upRes = await execFileP(
    'docker',
    ['compose', '-f', COMPOSE_FILE, 'up', '-d', '--build'],
    { timeout: 600000 }
  );
  log('info', 'docker compose build/up 完成', { stdout: (upRes.stdout || '').slice(0, 500) });
}

async function handleWebhook(req, res) {
  // 并发保护：进入处理函数立即置位（在读取 body 之前），
  // 防止 readBody 异步等待期间并发请求绕过守卫导致重复部署。
  if (deploying) {
    log('warn', '部署进行中，跳过本次 webhook', { reason: 'already running' });
    return sendJson(res, 200, { status: 'skipped', reason: 'already running' });
  }
  deploying = true;
  try {
    let raw;
    try {
      raw = await readBody(req);
    } catch (e) {
      log('error', '读取 body 失败', { error: e.message });
      return sendJson(res, 400, { status: 'error', detail: 'bad request body' });
    }

    let bodyObj = {};
    if (raw.length > 0) {
      try {
        bodyObj = JSON.parse(raw.toString('utf8'));
      } catch (e) {
        log('error', 'JSON 解析失败', { error: e.message });
        return sendJson(res, 400, { status: 'error', detail: 'invalid json' });
      }
    }

    // 鉴权
    if (!isAuthorized(req, bodyObj)) {
      log('warn', '鉴权失败', { token: maskToken(req.headers['x-gitee-token'] || '') });
      return sendJson(res, 401, { status: 'error', detail: 'unauthorized' });
    }

    // 事件类型校验：严格只认 push 事件（Gitee 通过 X-Gitee-Event 头标识）
    const event = req.headers['x-gitee-event'];
    if (event !== 'push') {
      log('info', '非 push 事件，忽略', { event: event || null });
      return sendJson(res, 200, { status: 'ignored', reason: 'not a push event' });
    }

    // 分支白名单：仅 main 分支触发部署
    const ref = bodyObj && bodyObj.ref;
    if (ref !== 'refs/heads/main') {
      log('info', '非 main 分支，跳过 build', { ref: ref || null });
      return sendJson(res, 200, { status: 'ignored', reason: 'not main branch' });
    }

    // 进入部署流程
    log('info', '收到 main 分支 push，启动自动部署');
    try {
      await runDeploy();
      log('info', '自动部署成功');
      return sendJson(res, 200, { status: 'ok' });
    } catch (e) {
      log('error', '自动部署失败', {
        error: e.message,
        stdout: (e.stdout || '').toString().slice(0, 500),
        stderr: (e.stderr || '').toString().slice(0, 500),
      });
      // 返回 500 但不要让进程崩溃
      return sendJson(res, 500, { status: 'error', detail: e.message });
    }
  } finally {
    // 无论走哪条分支（ignored / error / ok），都释放并发锁
    deploying = false;
  }
}

// ----------------------- 路由 -----------------------
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (req.method === 'GET' && url === '/') {
    return sendJson(res, 200, { status: 'ok', service: 'family-finance-autodeploy' });
  }

  if (req.method === 'POST' && url === '/webhook') {
    handleWebhook(req, res).catch((e) => {
      log('error', 'webhook 处理异常', { error: e.message });
      if (!res.headersSent) {
        sendJson(res, 500, { status: 'error', detail: 'internal error' });
      }
    });
    return;
  }

  return sendJson(res, 404, { status: 'error', detail: 'not found' });
});

// ----------------------- 进程健壮性 -----------------------
process.on('uncaughtException', (e) => {
  log('error', '未捕获异常', { error: e.message });
});
process.on('unhandledRejection', (e) => {
  log('error', '未处理的 Promise 拒绝', {
    error: e && e.message ? e.message : String(e),
  });
});

server.listen(PORT, () => {
  log('info', 'autodeploy 接收器已启动', {
    port: PORT,
    repo: REPO_DIR,
    tokenConfigured: Boolean(WEBHOOK_TOKEN),
  });
});

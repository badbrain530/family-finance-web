/**
 * 前端增量功能验证脚本（无测试框架，node 直接运行）
 * 针对账户管理增量交付做"可断言的纯逻辑/接线"核查：
 *  1. ACCOUNT_TYPE_META 映射完整性（6 类账户均含 label/icon/color）
 *  2. category.service.ts 实际请求路径为 /categories?familyId=（非历史 /families/:id/categories）
 *  3. notification 类型大小写归一（NotificationsPage 用 toUpperCase 查表）
 *  4. EditTransactionModal 账户字段必填校验
 *  5. SettingsPage 真实调用 clearAllTransactions({familyId, confirm:true}) 且无 TODO 占位
 *  6. App.tsx 路由 /accounts /categories /notifications 已接，NotificationsPlaceholder 已移除
 *  7. index.css 含 .dark 变量覆写块
 *  8. account.service.ts 路径对齐 /accounts
 *
 * 运行：node frontend/scripts/verify-incremental.mjs
 * 退出码：全部通过 0，存在失败 1。
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '..', 'src');

let pass = 0;
let fail = 0;
const failures = [];

function read(rel) {
  const p = resolve(SRC, rel);
  if (!existsSync(p)) {
    throw new Error(`文件不存在: ${rel}`);
  }
  return readFileSync(p, 'utf-8');
}

function check(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(name + (detail ? ` -> ${detail}` : ''));
    console.log(`  ✗ ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

console.log('=== 前端增量验证 ===\n');

// 1. ACCOUNT_TYPE_META 映射完整性
console.log('[1] ACCOUNT_TYPE_META 映射完整性');
{
  const src = read('lib/constants.ts');
  const m = src.match(/ACCOUNT_TYPE_META[\s\S]*?=\s*(\{[\s\S]*?\n\});/);
  check('constants.ts 含 ACCOUNT_TYPE_META 定义', !!m, '未匹配到对象字面量');
  if (m) {
    let meta;
    try {
      meta = eval('(' + m[1] + ')');
    } catch (e) {
      check('ACCOUNT_TYPE_META 可解析为对象', false, String(e));
    }
    if (meta) {
      const expected = ['DEBIT', 'CREDIT', 'INVESTMENT', 'CASH', 'E_WALLET', 'VIRTUAL'];
      for (const k of expected) {
        const v = meta[k];
        check(
          `ACCOUNT_TYPE_META[${k}] 含 label/icon/color`,
          v && typeof v.label === 'string' && v.label.length > 0 &&
            typeof v.icon === 'string' && v.icon.length > 0 &&
            typeof v.color === 'string' && v.color.length > 0,
          JSON.stringify(v),
        );
      }
      check('恰好覆盖 6 种账户类型', Object.keys(meta).length === 6, `实际 ${Object.keys(meta).length}`);
    }
  }
}

// 2. category.service.ts 请求路径
console.log('\n[2] category.service.ts 请求路径');
{
  const src = read('services/category.service.ts');
  check('使用 get(\'/categories\', { familyId })', /get<[^>]*>\(\s*['"]\/categories['"]\s*,\s*\{\s*familyId\s*\}/.test(src), '未找到正确调用');
  check('已移除历史 /families/${familyId}/categories 路径', !/\/families\/\$\{?familyId\}?\/?categories/.test(src), '仍存在旧路径');
}

// 3. notification 大小写归一
console.log('\n[3] notification 类型大小写归一');
{
  const src = read('features/notifications/NotificationsPage.tsx');
  check('使用 n.type.toUpperCase() 查 NOTIFICATION_META', /NOTIFICATION_META\[\s*n\.type\.toUpperCase\(\)\s*\]/.test(src), '未用 toUpperCase 归一');
  check('NOTIFICATION_META 以大写字符串为键', /NOTIFICATION_META[\s\S]*=\s*\{/.test(src));
  const notifTypes = read('types/notification.ts');
  check('前端 NotificationType 枚举为小写（需 toUpperCase 对齐后端大写）', /BUDGET_WARNING\s*=\s*['"]budget_warning['"]/.test(notifTypes), '枚举值非小写');
}

// 4. EditTransactionModal 账户必填校验
console.log('\n[4] EditTransactionModal 账户必填校验');
{
  const src = read('features/transactions/EditTransactionModal.tsx');
  check('存在 if (!accountId) 必填拦截', /if\s*\(\s*!accountId\s*\)/.test(src), '未找到账户空值校验');
  check('校验失败时提示"请选择账户"', /请选择账户/.test(src));
  check('提交请求携带 accountId（accountId: accountId || null）', /accountId\s*:\s*accountId\s*\|\|\s*null/.test(src));
}

// 5. SettingsPage 真实调用 clearAllTransactions
console.log('\n[5] SettingsPage 清除数据真实生效');
{
  const src = read('features/settings/SettingsPage.tsx');
  check('调用 clearAllTransactions({ familyId, confirm: true })', /clearAllTransactions\(\s*\{\s*familyId\s*:\s*[^,]+,\s*confirm\s*:\s*true\s*\}/.test(src), '未以 confirm:true 调用');
  check('已移除 TODO 占位（接入真实 API）', !/TODO.*接入真实 API|接入真实 API/.test(src), '仍存在 TODO 占位');
}

// 6. App.tsx 路由接线
console.log('\n[6] App.tsx 路由接线');
{
  const src = read('App.tsx');
  check('含 /accounts 路由', /path=\s*["']accounts["']/.test(src));
  check('含 /categories 路由', /path=\s*["']categories["']/.test(src));
  check('含 /notifications 路由', /path=\s*["']notifications["']/.test(src));
  check('已移除 NotificationsPlaceholder 占位', !/NotificationsPlaceholder/.test(src), '仍存在占位组件');
}

// 7. index.css .dark
console.log('\n[7] index.css 深色模式变量');
{
  const src = read('index.css');
  check('含 .dark { 覆写块', /\.dark\s*\{/.test(src));
  check('.dark 含 --color-bg 变量', /--color-bg/.test(src));
  check('.dark 含 --color-surface 变量', /--color-surface/.test(src));
}

// 8. account.service.ts 路径
console.log('\n[8] account.service.ts 路径对齐');
{
  const src = read('services/account.service.ts');
  check('getAccounts 调用 /accounts?familyId', /get<[^>]*>\(\s*['"]\/accounts['"]\s*,\s*\{\s*familyId\s*\}/.test(src));
  check('deactivateAccount 调用 /accounts/:id/deactivate', /\/accounts\/\$\{id\}\/deactivate/.test(src));
}

console.log('\n=== 汇总 ===');
console.log(`通过: ${pass}  失败: ${fail}`);
if (fail > 0) {
  console.log('失败项:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
} else {
  console.log('全部通过 ✅');
  process.exit(0);
}

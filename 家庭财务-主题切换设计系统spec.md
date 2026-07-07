# 家庭财务 App · 主题切换设计系统规范（已集成至前端代码）

> **状态**：配色决策已确认，方案已就绪，且**已集成至前端代码**（见 `frontend/src/index.css` + `tailwind.config.ts`，与设计原型 `family-finance-app/styles.css` 的 Token 完全对齐）。Ardot 设计文件 `700242463854201` 的连接仍为 `NO_ADAPTER`（断开），设计稿内变量重绑待连接后执行；但代码侧已落地，无需等待 Ardot。

## 一、已确认的配色决策（用户选择）

| 决策项 | 选择 | 说明 |
|--------|------|------|
| Light 模式主色 | 蓝灰 `#3B82F6` | 彻底离开刺眼的翡翠绿，稳重通用 |
| Dark 模式背景 | 深蓝灰 `#0B1220` | 现代暗夜质感，护眼 |

> 原主色 `#00C896` 在 Light 模式全量替换为 `#3B82F6`；并新增完整的 Dark 模式变量，实现 Light/Dark 一键切换。

## 二、变量集合设计（`Theme` 集合，双模式 Light / Dark）

变量命名不含 `$` / `:`，均为 `COLOR` 类型，值用 `{r,g,b,a}`（0~1）。

| 变量名 | Light 值 | Dark 值 | 语义 |
|--------|----------|---------|------|
| `color.primary` | #3B82F6 | #60A5FA | 主色（按钮/激活/强调） |
| `color.primaryHover` | #2563EB | #93C5FD | 主色悬停 |
| `color.primarySoft` | #EFF6FF | #1E293B | 主色浅底（标签/选中背景） |
| `color.bg` | #F8F9FA | #0B1220 | 页面背景 |
| `color.surface` | #FFFFFF | #131A2A | 卡片/表面 |
| `color.surfaceRaised` | #FFFFFF | #1A2236 | 浮层/弹窗/下拉 |
| `color.border` | #E2E8F0 | #2A3447 | 描边/分隔线 |
| `color.textPrimary` | #0F172A | #E2E8F0 | 主文字 |
| `color.textSecondary` | #64748B | #94A3B8 | 次要文字 |
| `color.textMuted` | #94A3B8 | #64748B | 弱化文字/占位 |
| `color.success` | #10B981 | #34D399 | 收入/正向（不再与主色撞色） |
| `color.danger` | #EF4444 | #F87171 | 支出/错误 |
| `color.warning` | #F59E0B | #FBBF24 | 警告 |
| `color.info` | #3B82F6 | #60A5FA | 信息（同主色） |

## 三、可直接执行的 `apply_variables` JSON 载荷

```json
{
  "Theme": {
    "modes": ["Light", "Dark"],
    "variables": {
      "color.primary":      { "type": "COLOR", "valuesByMode": { "Light": {"r":0.2314,"g":0.5098,"b":0.9647,"a":1}, "Dark": {"r":0.3765,"g":0.6471,"b":0.9804,"a":1} }, "scopes": ["FILL","STROKE","TEXT"] },
      "color.primaryHover": { "type": "COLOR", "valuesByMode": { "Light": {"r":0.1451,"g":0.3882,"b":0.9216,"a":1}, "Dark": {"r":0.5765,"g":0.7725,"b":0.9922,"a":1} }, "scopes": ["FILL"] },
      "color.primarySoft":  { "type": "COLOR", "valuesByMode": { "Light": {"r":0.9373,"g":0.9647,"b":1.0,"a":1},    "Dark": {"r":0.1176,"g":0.1608,"b":0.2314,"a":1} }, "scopes": ["FILL"] },
      "color.bg":           { "type": "COLOR", "valuesByMode": { "Light": {"r":0.9725,"g":0.9765,"b":0.9804,"a":1}, "Dark": {"r":0.0431,"g":0.0706,"b":0.1255,"a":1} }, "scopes": ["FILL"] },
      "color.surface":       { "type": "COLOR", "valuesByMode": { "Light": {"r":1.0,"g":1.0,"b":1.0,"a":1},          "Dark": {"r":0.0745,"g":0.1020,"b":0.1647,"a":1} }, "scopes": ["FILL"] },
      "color.surfaceRaised": { "type": "COLOR", "valuesByMode": { "Light": {"r":1.0,"g":1.0,"b":1.0,"a":1},          "Dark": {"r":0.1020,"g":0.1333,"b":0.2118,"a":1} }, "scopes": ["FILL"] },
      "color.border":        { "type": "COLOR", "valuesByMode": { "Light": {"r":0.8863,"g":0.9098,"b":0.9412,"a":1}, "Dark": {"r":0.1647,"g":0.2039,"b":0.2784,"a":1} }, "scopes": ["STROKE","FILL"] },
      "color.textPrimary":   { "type": "COLOR", "valuesByMode": { "Light": {"r":0.0588,"g":0.0902,"b":0.1647,"a":1}, "Dark": {"r":0.8863,"g":0.9098,"b":0.9412,"a":1} }, "scopes": ["TEXT","FILL"] },
      "color.textSecondary": { "type": "COLOR", "valuesByMode": { "Light": {"r":0.3922,"g":0.4549,"b":0.5451,"a":1}, "Dark": {"r":0.5804,"g":0.6392,"b":0.7216,"a":1} }, "scopes": ["TEXT","FILL"] },
      "color.textMuted":     { "type": "COLOR", "valuesByMode": { "Light": {"r":0.5804,"g":0.6392,"b":0.7216,"a":1}, "Dark": {"r":0.3922,"g":0.4549,"b":0.5451,"a":1} }, "scopes": ["TEXT","FILL"] },
      "color.success":       { "type": "COLOR", "valuesByMode": { "Light": {"r":0.0627,"g":0.7255,"b":0.5059,"a":1}, "Dark": {"r":0.2039,"g":0.8275,"b":0.6000,"a":1} }, "scopes": ["FILL","TEXT"] },
      "color.danger":        { "type": "COLOR", "valuesByMode": { "Light": {"r":0.9373,"g":0.2667,"b":0.2667,"a":1}, "Dark": {"r":0.9725,"g":0.4431,"b":0.4431,"a":1} }, "scopes": ["FILL","TEXT"] },
      "color.warning":       { "type": "COLOR", "valuesByMode": { "Light": {"r":0.9608,"g":0.6196,"b":0.0431,"a":1}, "Dark": {"r":0.9843,"g":0.7490,"b":0.1412,"a":1} }, "scopes": ["FILL","TEXT"] },
      "color.info":          { "type": "COLOR", "valuesByMode": { "Light": {"r":0.2314,"g":0.5098,"b":0.9647,"a":1}, "Dark": {"r":0.3765,"g":0.6471,"b":0.9804,"a":1} }, "scopes": ["FILL","TEXT"] }
    }
  }
}
```

## 四、执行步骤（连接恢复后按顺序执行）

1. **`apply_variables`** 写入上面的 `Theme` 集合（Light/Dark 双模式）。
2. **`batch_read`** 读取「设计系统」页（2:1）与各页面，定位所有硬编码颜色节点（原 `#00C896` 及其衍生色）。
3. **`batch_edit` 重绑**：将组件填充/描边/文字绑定到对应 `Theme` 变量（用 `boundVariables`）。
   - 优先检查是否使用了组件（COMPONENT/INSTANCE）——若是，**只重绑主组件**，所有实例自动跟随，16 页一次搞定。
   - 否则逐页将 `#00C896` → `color.primary` 等变量引用。
4. **切换验证**：在 Ardot 中将 `Theme` 集合活动模式切到 `Dark`，截图核对各页深色表现；再切回 `Light`。
5. **截图验收**：`capture_screenshot` 抽查「设计系统」页 + Web/Mobile 各 1 页。

## 五、当前文件结构（已知）

- 文件：`家庭财务App-Web移动端设计`（fileId `700242463854201`），权限 readwrite
- 16 页：设计系统(2:1) + Web×7(2:2~2:8) + Mobile×7(2:9~2:15) + 空 Page1(0:1)
- 现有 `variableSets: []` —— **无变量系统**，当前全部为硬编码颜色，故必须先建变量再重绑。

## 六、下一步（需用户操作）

请重新连接 / 刷新 Ardot 编辑器（确保适配器在线），回复「已重连」后我立即按第四节执行：先建 `Theme` 变量集，再把刺眼绿全量替换为蓝灰主色，并落地 Dark 模式切换。

## 七、代码集成记录（2026-07-07）

设计稿 Token 已落地到前端 `frontend/`，与可视原型 `family-finance-app/styles.css` 完全对齐：

- **`src/index.css`**
  - `:root`（Light）：`--color-primary:#3B82F6`、`--color-bg:#F8F9FA`、`--color-surface:#FFFFFF`、`--color-success:#10B981`、`--color-danger:#EF4444`、`--color-warning:#F59E0B`、`--color-info:#3B82F6` 等。
  - `.dark`：主色提亮 `#60A5FA`、背景 `#0B1220`、表面 `#131A2A`、描边 `#2A3447`、success `#34D399`、danger `#F87171`、warning `#FBBF24` 等。
- **`tailwind.config.ts`**：`primary` 色阶改为蓝灰，浅色系（50/100/200/300）与激活文字（600/700）经 CSS 变量驱动，深色模式一键反相；`income/expense/budget*` 对齐 `success/danger/warning`；新增 `success/danger/warning/info` 别名。
- **硬编码旧翡翠绿 `#00C896` 及衍生色全量替换**：`lib/categories.ts`（收入分类绿 → 新 success 绿族）、`lib/constants.ts`（`DEBIT` 账户类型色 → 主蓝）、`charts/BarChart|LineChart`、`CategoryTag`、`MonthlyReportPage`、`NotificationsPage`、`FamilyLedgerPage` 等。

> 代码侧已脱离对 Ardot 连接的依赖；设计稿变量重绑仅为设计文件自身整洁度，不影响线上应用。

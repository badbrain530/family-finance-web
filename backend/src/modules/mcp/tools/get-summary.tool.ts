import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getSummaryToolSchema, GetSummaryToolInput } from '../dto/mcp-get-summary.dto';
import { requireMcpContext } from '../mcp.context';
import { toMcpError } from '../mcp.errors';
import type { McpToolDeps } from '../mcp.types';

/**
 * 注册 getSummary 工具（只读，首版唯一开放的分析工具）。
 *
 * 直接复用 AiReportService.aggregateSummary(familyId, start, end)：
 * - familyId 来自 MCP 上下文（Key 解析），保证仅统计该家庭；
 * - 返回结构化 JSON（总收入 / 净支出 / 结余 / 分类明细 / 异常项），
 *   结论由 QClaw 本地 LLM 基于本数据生成（P0-05 去 LLM）。
 */
export function registerGetSummaryTool(
  server: McpServer,
  deps: McpToolDeps,
): void {
  server.registerTool(
    'getSummary',
    {
      title: '财务汇总',
      description:
        '返回任意时间区间的财务结构化汇总：总收入、净支出、结余、分类明细、异常项。' +
        '结论由智能体本地生成，本工具仅提供数据（P0-05 去 LLM）。',
      inputSchema: getSummaryToolSchema.shape,
    },
    async (args: GetSummaryToolInput) => {
      const ctx = requireMcpContext();
      try {
        const summary = await deps.aiReportService.aggregateSummary(
          ctx.familyId,
          new Date(args.startDate),
          new Date(args.endDate),
        );
        return {
          content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
        };
      } catch (err) {
        throw toMcpError(err);
      }
    },
  );
}

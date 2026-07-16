import { z } from 'zod';

/**
 * getSummary 工具的入参 Schema（独立于 web DTO）。
 * 返回区间由智能体指定；家庭维度由工具内部从 MCP 上下文（Key 解析）取得，绝不信任客户端。
 */
export const getSummaryToolSchema = z.object({
  startDate: z
    .string()
    .describe('统计起始日期 ISO 8601（含），如 "2026-07-01"'),
  endDate: z
    .string()
    .describe('统计结束日期 ISO 8601（不含），即统计区间为 [startDate, endDate)'),
});

/** 由 Schema 推断的工具入参类型 */
export type GetSummaryToolInput = z.infer<typeof getSummaryToolSchema>;

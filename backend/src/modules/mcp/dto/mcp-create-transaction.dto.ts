import { z } from 'zod';

/**
 * createTransaction 工具的入参 Schema（独立于 web DTO）。
 *
 * 设计原则（共享知识 §7）：
 * - 这是「智能体（QClaw）视角」的输入契约，通过 MCP 协议以 JSON Schema 形式暴露给客户端；
 * - 不复用网页 DTO（class-validator），避免被全局 ValidationPipe / whitelist 干扰；
 * - 工具内部将其翻译为既有 TransactionsService.createTransaction 入参。
 */
export const createTransactionToolSchema = z.object({
  type: z
    .enum(['income', 'expense'])
    .describe('交易类型：income=收入，expense=支出'),
  amount: z
    .number()
    .positive()
    .describe('交易金额，正数，单位元（最多 2 位小数）'),
  date: z
    .string()
    .describe('交易日期，ISO 8601 字符串，如 "2026-07-16" 或 "2026-07-16T10:30:00.000Z"'),
  categoryName: z
    .string()
    .optional()
    .describe('分类名称或关键词，如 "餐饮食品"、"打车"；无法匹配时归入未分类'),
  merchant: z.string().optional().describe('商户名'),
  note: z.string().optional().describe('备注说明'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('智能体对本次识别的置信度 0~1，可选'),
});

/** 由 Schema 推断的工具入参类型 */
export type CreateTransactionToolInput = z.infer<typeof createTransactionToolSchema>;

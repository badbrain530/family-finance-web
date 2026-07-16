import { z } from 'zod';

/**
 * getTransactions 工具的入参 Schema（独立于 web DTO）。
 * 仅暴露必要的筛选维度，账本维度由工具内部解析默认账本，确保家庭隔离。
 */
export const getTransactionsToolSchema = z.object({
  type: z
    .enum(['income', 'expense'])
    .optional()
    .describe('筛选交易类型：income=收入，expense=支出；留空返回全部'),
  dateFrom: z.string().optional().describe('起始日期 ISO 8601（含）'),
  dateTo: z.string().optional().describe('结束日期 ISO 8601（含）'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe('每页条数，1~100，默认 20'),
  page: z.number().int().min(1).optional().default(1).describe('页码，默认 1'),
});

/** 由 Schema 推断的工具入参类型 */
export type GetTransactionsToolInput = z.infer<typeof getTransactionsToolSchema>;

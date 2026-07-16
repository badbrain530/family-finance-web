import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  createTransactionToolSchema,
  CreateTransactionToolInput,
} from '../dto/mcp-create-transaction.dto';
import { requireMcpContext, assertWritable } from '../mcp.context';
import { toMcpError } from '../mcp.errors';
import { serializeTransaction } from '../mcp.serializer';
import type { McpToolDeps } from '../mcp.types';

/**
 * 注册 createTransaction 工具。
 *
 * 流程（共享知识 §7）：
 * 1. 取 MCP 上下文（familyId / userId 来自 Key，绝不信任客户端）；
 * 2. readonly 作用域拒绝（assertWritable）；
 * 3. 解析默认账本（getDefaultLedger）→ 既有 getLedger 完成家庭隔离校验；
 * 4. categoryName → matchCategoryByKeyword 解析为 categoryId（无匹配则未分类）；
 * 5. 调用既有 TransactionsService.createTransaction，source 硬编码 'agent'。
 */
export function registerCreateTransactionTool(
  server: McpServer,
  deps: McpToolDeps,
): void {
  server.registerTool(
    'createTransaction',
    {
      title: '创建交易',
      description:
        '在家庭默认账本中创建一笔交易（收入/支出）。由智能体（QClaw）调用，来源固定标记为 agent；' +
        'categoryName 会通过家庭分类体系自动匹配为 categoryId，无法匹配时归入未分类。',
      inputSchema: createTransactionToolSchema.shape,
    },
    async (args: CreateTransactionToolInput) => {
      const ctx = requireMcpContext();
      assertWritable(ctx);
      try {
        const ledger = await deps.ledgersService.getDefaultLedger(ctx.familyId);

        let categoryId: string | null = null;
        if (args.categoryName) {
          const matched = await deps.categoriesService.matchCategoryByKeyword(
            ctx.familyId,
            args.categoryName,
          );
          categoryId = matched?.categoryId ?? null;
        }

        const tx = await deps.transactionsService.createTransaction(ctx.userId, {
          ledgerId: ledger.id,
          type: args.type,
          amount: args.amount,
          date: args.date,
          categoryId,
          merchant: args.merchant ?? null,
          note: args.note ?? null,
          source: 'agent',
          aiConfidence: args.confidence ?? null,
        } as never);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeTransaction(tx as never), null, 2),
            },
          ],
        };
      } catch (err) {
        throw toMcpError(err);
      }
    },
  );
}

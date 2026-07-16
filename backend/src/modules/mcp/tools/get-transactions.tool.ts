import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getTransactionsToolSchema,
  GetTransactionsToolInput,
} from '../dto/mcp-get-transactions.dto';
import { requireMcpContext } from '../mcp.context';
import { toMcpError } from '../mcp.errors';
import { serializeTransaction } from '../mcp.serializer';
import type { McpToolDeps } from '../mcp.types';
import type { QueryTransactionDto } from '../../transactions/dto/query-transaction.dto';

/**
 * 注册 getTransactions 工具（只读）。
 *
 * 家庭隔离策略：工具内部解析默认账本，将 ledgerId 作为查询条件传入既有
 * TransactionsService.getTransactions，由 getLedger 完成家庭归属校验，
 * 杜绝越权访问其他家庭数据（共享知识 §7）。
 */
export function registerGetTransactionsTool(
  server: McpServer,
  deps: McpToolDeps,
): void {
  server.registerTool(
    'getTransactions',
    {
      title: '查询交易',
      description:
        '分页查询家庭默认账本下的交易记录，支持按类型 / 日期区间筛选。只读工具，不修改任何数据。',
      inputSchema: getTransactionsToolSchema.shape,
    },
    async (args: GetTransactionsToolInput) => {
      const ctx = requireMcpContext();
      try {
        const ledger = await deps.ledgersService.getDefaultLedger(ctx.familyId);

        const query = {
          ledgerId: ledger.id,
          type: args.type,
          dateFrom: args.dateFrom,
          dateTo: args.dateTo,
          page: args.page ?? 1,
          pageSize: args.limit ?? 20,
          sortBy: 'date',
          sortOrder: 'desc',
        } as unknown as QueryTransactionDto;

        const result = await deps.transactionsService.getTransactions(
          ctx.userId,
          query,
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  total: result.total,
                  page: result.page,
                  pageSize: result.pageSize,
                  totalPages: result.totalPages,
                  items: result.items.map((tx) => serializeTransaction(tx as never)),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        throw toMcpError(err);
      }
    },
  );
}

import type { TransactionsService } from '../transactions/transactions.service';
import type { LedgersService } from '../ledgers/ledgers.service';
import type { CategoriesService } from '../categories/categories.service';
import type { AiReportService } from '../ai/ai-report.service';

/**
 * MCP 工具注册所需依赖。
 * 三个核心工具全部复用既有业务 service，避免重复实现（共享知识 §7）。
 */
export interface McpToolDeps {
  transactionsService: TransactionsService;
  ledgersService: LedgersService;
  categoriesService: CategoriesService;
  aiReportService: AiReportService;
}

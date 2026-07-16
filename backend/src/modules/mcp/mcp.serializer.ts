/**
 * 交易记录序列化工具。
 * 将 Prisma 返回的交易对象转换为 MCP 工具返回的安全结构（统一小写枚举、金额转 number、日期转 ISO）。
 */
export function serializeTransaction(tx: {
  id: string;
  ledgerId: string;
  type: string;
  amount: unknown;
  date: Date | string;
  merchant?: string | null;
  note?: string | null;
  categoryId?: string | null;
  category?: { name?: string } | null;
  source: string;
  createdAt?: Date | string;
}): Record<string, unknown> {
  return {
    id: tx.id,
    ledgerId: tx.ledgerId,
    type: tx.type.toLowerCase(),
    amount: typeof tx.amount === 'object' || typeof tx.amount === 'string'
      ? Number(tx.amount)
      : tx.amount,
    date: tx.date instanceof Date ? tx.date.toISOString() : tx.date,
    merchant: tx.merchant ?? null,
    note: tx.note ?? null,
    categoryId: tx.categoryId ?? null,
    categoryName: tx.category?.name ?? null,
    source: tx.source.toLowerCase(),
    createdAt: tx.createdAt instanceof Date ? tx.createdAt.toISOString() : tx.createdAt,
  };
}

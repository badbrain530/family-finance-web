import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * 将任意异常（含 Nest HttpException）映射为 MCP 协议错误。
 * 4xx（客户端可修正）→ InvalidRequest；其余（5xx / 未知）→ InternalError。
 * 这样 QClaw 能拿到结构化 JSON-RPC 错误，而非未捕获的堆栈。
 */
export function toMcpError(err: unknown): McpError {
  const message = err instanceof Error ? err.message : String(err);
  const status =
    (err as { status?: number })?.status ??
    (err as { statusCode?: number })?.statusCode;

  if (status && status >= 400 && status < 500) {
    return new McpError(ErrorCode.InvalidRequest, `请求被拒绝：${message}`);
  }
  return new McpError(ErrorCode.InternalError, `服务端处理失败：${message}`);
}

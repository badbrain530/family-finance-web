import { AsyncLocalStorage } from 'node:async_hooks';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ApiKeyScope } from '../apikey/apikey.service';

/**
 * MCP 请求上下文
 * 由 ApiKeyAuthMiddleware 从 X-API-Key 解析后注入，贯穿整次请求（含所有工具调用）。
 * familyId / userId / scope 一律来自 Key，绝不信任客户端传入（越权防护核心）。
 */
export interface McpContext {
  apiKeyId: string;
  userId: string;
  familyId: string;
  scope: ApiKeyScope;
}

/** 跨 async 调用保持 MCP 上下文（streamable-http 每次请求一条链路，稳健穿透） */
export const mcpContextStorage = new AsyncLocalStorage<McpContext>();

/** 读取当前请求上下文（可能为 undefined，仅在不经鉴权中间件时） */
export function getMcpContext(): McpContext | undefined {
  return mcpContextStorage.getStore();
}

/** 强制读取上下文；缺失说明鉴权中间件未生效，直接报错 */
export function requireMcpContext(): McpContext {
  const ctx = mcpContextStorage.getStore();
  if (!ctx) {
    throw new McpError(
      ErrorCode.InternalError,
      'MCP 上下文缺失：鉴权中间件未生效',
    );
  }
  return ctx;
}

/**
 * 写类工具（createTransaction 等）前置校验：
 * readonly 作用域禁止写操作，统一以 MCP 协议错误拒绝。
 */
export function assertWritable(ctx: McpContext): void {
  if (ctx.scope === 'READONLY') {
    throw new McpError(
      ErrorCode.InvalidRequest,
      '当前 API Key 为只读（readonly），禁止执行写操作（createTransaction 等）',
    );
  }
}

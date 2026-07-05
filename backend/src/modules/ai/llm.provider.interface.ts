/**
 * LLM Provider 接口抽象
 * MVP阶段必须做的预留：支持通义千问/DeepSeek/文心一言切换
 *
 * 当前实现：通义千问（QianwenProvider）
 * 未来扩展：DeepSeekProvider（成本优化）、WenxinProvider（备用）
 *
 * 使用方式：
 *   1. 通过 AiModule 注入对应的 Provider 实现
 *   2. 通过环境变量 LLM_PROVIDER 切换 Provider
 */

/** 聊天消息角色 */
export type ChatRole = 'system' | 'user' | 'assistant';

/** 聊天消息 */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** LLM调用选项 */
export interface LLMOptions {
  temperature?: number;     // 温度（0-1），值越低输出越确定
  maxTokens?: number;       // 最大生成token数
  topP?: number;            // 核采样参数
  model?: string;           // 模型名称覆盖
}

/** LLM响应 */
export interface LLMResponse {
  content: string;          // 生成的文本内容
  model: string;            // 使用的模型
  usage: {
    promptTokens: number;   // 输入token数
    completionTokens: number; // 输出token数
    totalTokens: number;    // 总token数
  };
  finishReason: string;     // 结束原因（stop/length/content_filter）
}

/** Function Calling 函数定义 */
export interface FunctionDef {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
}

/** Function Calling 结果 */
export interface FunctionCallResult {
  name: string;
  arguments: Record<string, any>;
}

/**
 * LLM Provider 接口
 * 所有LLM服务提供商必须实现此接口
 */
export interface ILLMProvider {
  /** 提供商名称 */
  readonly name: string;

  /**
   * 聊天补全
   * @param messages 消息列表
   * @param options 调用选项
   * @returns LLM响应
   */
  chat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse>;

  /**
   * Function Calling
   * 用于结构化输出（如NLP记账解析、AI分类）
   * @param prompt 用户提示
   * @param functions 可用函数列表
   * @param options 调用选项
   * @returns 函数调用结果
   */
  functionCall(
    prompt: string,
    functions: FunctionDef[],
    options?: LLMOptions,
  ): Promise<FunctionCallResult>;

  /**
   * 文本向量化（为RAG预留）
   * MVP阶段不实现，P2阶段AI对话顾问需要
   * @param text 待向量化的文本
   * @returns 向量数组
   */
  embedding?(text: string): Promise<number[]>;
}

/**
 * LLM Provider 类型
 */
export type LLMProviderType = 'qianwen' | 'deepseek' | 'wenxin';

/**
 * 获取当前配置的LLM Provider类型
 */
export function getLLMProviderType(): LLMProviderType {
  return (process.env.LLM_PROVIDER as LLMProviderType) || 'qianwen';
}

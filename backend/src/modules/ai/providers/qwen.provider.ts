/**
 * 通义千问（Qianwen）LLM Provider 实现
 * 通过阿里云DashScope API调用通义千问大模型
 *
 * API文档：https://dashscope.aliyuncs.com/api/v1/services/aigeneration/text-generation/generation
 *
 * 环境变量：
 * - LLM_API_KEY: DashScope API Key
 * - LLM_MODEL: 模型名称（默认 qwen-turbo）
 */

import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  ILLMProvider,
  ChatMessage,
  LLMOptions,
  LLMResponse,
  FunctionDef,
  FunctionCallResult,
} from '../llm.provider.interface';

/** 通义千问API端点 */
const DASHSCOPE_ENDPOINT =
  'https://dashscope.aliyuncs.com/api/v1/services/aigeneration/text-generation/generation';

/** 默认模型 */
const DEFAULT_MODEL = 'qwen-turbo';

/** 默认超时时间（毫秒） */
const DEFAULT_TIMEOUT = 30000;

/** 最大重试次数 */
const MAX_RETRIES = 3;

/** 重试延迟基数（毫秒） */
const RETRY_DELAY_BASE = 1000;

@Injectable()
export class QwenProvider implements ILLMProvider {
  private readonly logger = new Logger(QwenProvider.name);
  readonly name = 'qianwen';

  /** API Key（从环境变量读取） */
  private readonly apiKey: string;

  /** 默认模型 */
  private readonly defaultModel: string;

  /** HTTP客户端实例 */
  private readonly httpClient: AxiosInstance;

  constructor() {
    this.apiKey = process.env.LLM_API_KEY || '';
    this.defaultModel = process.env.LLM_MODEL || DEFAULT_MODEL;

    if (!this.apiKey) {
      this.logger.warn('LLM_API_KEY 环境变量未设置，AI功能将不可用');
    }

    // 创建带超时的axios实例
    this.httpClient = axios.create({
      timeout: DEFAULT_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
  }

  /**
   * 聊天补全
   * @param messages 消息列表
   * @param options 调用选项
   * @returns LLM响应
   */
  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const model = options?.model || this.defaultModel;

    const requestBody = {
      model,
      input: {
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      },
      parameters: {
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 1024,
        top_p: options?.topP ?? 0.9,
        result_format: 'text',
      },
    };

    return this.callWithRetry(async () => {
      const response = await this.httpClient.post(DASHSCOPE_ENDPOINT, requestBody);

      const data = response.data;
      const output = data.output || {};
      const usage = data.usage || {};

      return {
        content: output.text || '',
        model,
        usage: {
          promptTokens: usage.input_tokens || 0,
          completionTokens: usage.output_tokens || 0,
          totalTokens: usage.total_tokens || 0,
        },
        finishReason: output.finish_reason || 'stop',
      };
    });
  }

  /**
   * Function Calling
   * 用于结构化输出（如NLP记账解析、AI分类）
   *
   * 通义千问支持通过messages方式调用function calling
   * 这里使用简化的方式：通过prompt要求返回JSON格式
   *
   * @param prompt 用户提示
   * @param functions 可用函数列表
   * @param options 调用选项
   * @returns 函数调用结果
   */
  async functionCall(
    prompt: string,
    functions: FunctionDef[],
    options?: LLMOptions,
  ): Promise<FunctionCallResult> {
    const model = options?.model || this.defaultModel;

    // 构建系统提示：要求模型以JSON格式返回函数调用
    const funcDescriptions = functions
      .map((f) => `- ${f.name}: ${f.description}\n  参数: ${JSON.stringify(f.parameters)}`)
      .join('\n');

    const systemPrompt = `你是一个智能助手。请根据用户输入，选择最合适的函数并返回其参数。
可用的函数：
${funcDescriptions}

请严格按照以下JSON格式返回结果，不要包含任何其他文字：
{"name": "函数名", "arguments": {参数对象}}

如果无法匹配任何函数，返回：
{"name": "none", "arguments": {}}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    const response = await this.chat(messages, {
      ...options,
      temperature: options?.temperature ?? 0.1, // 结构化输出用低温度
    });

    // 解析JSON响应
    try {
      // 提取JSON部分（模型可能返回markdown代码块）
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          name: parsed.name || 'none',
          arguments: parsed.arguments || {},
        };
      }
    } catch (err) {
      this.logger.warn(
        `Function Calling JSON解析失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 解析失败，返回默认值
    return {
      name: 'none',
      arguments: {},
    };
  }

  /**
   * 文本向量化（为RAG预留）
   * 使用通义千问的文本嵌入模型
   * MVP阶段不强制实现，P2阶段AI对话顾问需要
   *
   * @param text 待向量化的文本
   * @returns 向量数组
   */
  async embedding(text: string): Promise<number[]> {
    const embeddingEndpoint =
      'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding';

    const requestBody = {
      model: 'text-embedding-v1',
      input: {
        texts: [text],
      },
    };

    return this.callWithRetry(async () => {
      const response = await this.httpClient.post(embeddingEndpoint, requestBody);
      const embeddings = response.data?.output?.embeddings;
      if (embeddings && embeddings.length > 0) {
        return embeddings[0].embedding as number[];
      }
      return [];
    });
  }

  // ==================== 内部方法 ====================

  /**
   * 带重试的API调用
   * 遇到网络错误或429（限流）时自动重试
   *
   * @param fn 调用函数
   * @returns 调用结果
   */
  private async callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 判断是否可重试
        const axiosError = error as AxiosError;
        const statusCode = axiosError?.response?.status;

        if (!statusCode || statusCode === 429 || statusCode >= 500) {
          // 可重试的错误：限流、服务端错误、网络错误
          const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
          this.logger.warn(
            `API调用失败(第${attempt + 1}次), 状态码=${statusCode || 'N/A'}, ` +
            `${delay}ms后重试: ${lastError.message}`,
          );
          await this.sleep(delay);
          continue;
        }

        // 不可重试的错误（如400/401/403），直接抛出
        break;
      }
    }

    throw lastError || new Error('API调用失败');
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

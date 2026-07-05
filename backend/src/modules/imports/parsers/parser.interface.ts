/**
 * 账单解析器接口
 * 所有平台解析器（支付宝/微信/银行）必须实现此接口
 *
 * 设计模式：策略模式 + 工厂模式
 * - 每个平台一个独立Parser类，实现统一的IBillParser接口
 * - ParserFactory根据platform字符串返回对应Parser实例
 * - 新增平台只需添加新Parser并注册到工厂
 */

/**
 * 解析后的交易数据结构
 * Parser输出的统一格式，供ImportService使用
 */
export interface ParsedTransaction {
  /** 交易日期（ISO字符串或Date） */
  date: Date;
  /** 金额（正数，类型由type字段决定） */
  amount: number;
  /** 交易类型：收入或支出 */
  type: 'income' | 'expense';
  /** 交易描述/商品说明 */
  description: string;
  /** 交易对方/商户名称（用于AI分类） */
  merchant: string | null;
  /** 交易号（用于去重） */
  transactionNo: string | null;
  /** 支付方式（如余额/银行卡/花呗等） */
  paymentMethod: string | null;
  /** 交易状态（已成功/已退款等） */
  status: string | null;
  /** 原始行数据（调试用） */
  raw?: string;
}

/**
 * 解析结果
 */
export interface ParseResult {
  /** 成功解析的交易列表 */
  transactions: ParsedTransaction[];
  /** 解析跳过的记录数（格式异常、非交易记录等） */
  skippedCount: number;
  /** 解析错误信息列表 */
  errors: string[];
}

/**
 * 账单解析器接口
 */
export interface IBillParser {
  /** 平台标识 */
  readonly platform: string;

  /**
   * 解析账单文件
   * @param buffer 文件内容Buffer
   * @returns 解析结果（交易列表 + 跳过数 + 错误信息）
   */
  parse(buffer: Buffer): ParseResult;
}

/**
 * 支持的导入平台
 */
export type ImportPlatformType = 'alipay' | 'wechat' | 'cmb' | 'icbc' | 'ccb';

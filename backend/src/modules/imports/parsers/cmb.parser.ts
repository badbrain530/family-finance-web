/**
 * 招商银行账单解析器
 * 支持招商银行CSV和文本格式账单
 *
 * 招行账单格式特征：
 * - CSV格式：交易日期,交易摘要,交易金额,账户余额,币种
 * - 日期格式：2024/06/15 或 2024-06-15
 * - 金额正负号表示收支（正=收入，负=支出）
 * - 交易摘要包含商户信息和交易类型
 *
 * 注意：招行PDF账单需要先用pdf-parse提取文本，再按文本格式解析
 */

import { Injectable, Logger } from '@nestjs/common';
import { IBillParser, ParsedTransaction, ParseResult } from './parser.interface';

/** 招行CSV列索引映射 */
const CMB_CSV_COLUMNS = {
  date: 0,          // 交易日期
  summary: 1,       // 交易摘要
  amount: 2,        // 交易金额
  balance: 3,       // 账户余额
  currency: 4,      // 币种
} as const;

/** 收入关键词（摘要中包含则判定为收入） */
const INCOME_KEYWORDS = ['工资', '转入', '存入', '还款', '退款', '利息', '收益', '转账收入', '代发'];

/** 支出关键词 */
const EXPENSE_KEYWORDS = ['消费', '支出', '转账支出', '取款', '缴费', '支付', '扣款', '还款支出'];

@Injectable()
export class CmbParser implements IBillParser {
  private readonly logger = new Logger(CmbParser.name);
  readonly platform = 'cmb';

  /**
   * 解析招商银行账单文件
   * @param buffer 文件内容
   * @returns 解析结果
   */
  parse(buffer: Buffer): ParseResult {
    const text = buffer.toString('utf8');

    // 检测格式：CSV或文本
    if (text.includes('交易日期') || text.includes('记账日期')) {
      return this.parseCSV(text);
    }

    // 尝试文本格式（PDF提取后的文本）
    return this.parseText(text);
  }

  /**
   * 解析CSV格式账单
   */
  private parseCSV(text: string): ParseResult {
    const transactions: ParsedTransaction[] = [];
    const errors: string[] = [];
    let skippedCount = 0;

    const lines = text.split(/\r?\n/);

    // 找到列标题行
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('交易日期') || lines[i].includes('记账日期')) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      errors.push('未找到招商银行CSV列标题行');
      return { transactions, skippedCount, errors };
    }

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('-')) {
        continue;
      }

      // 跳过汇总行
      if (line.includes('期初') || line.includes('期末') || line.includes('合计')) {
        skippedCount++;
        continue;
      }

      try {
        const cols = this.parseLine(line);

        if (cols.length < 3) {
          skippedCount++;
          continue;
        }

        const dateStr = (cols[CMB_CSV_COLUMNS.date] || '').trim();
        const summary = (cols[CMB_CSV_COLUMNS.summary] || '').trim();
        const amountStr = (cols[CMB_CSV_COLUMNS.amount] || '').trim();

        if (!dateStr || !amountStr) {
          skippedCount++;
          continue;
        }

        // 解析金额（招行金额可能带正负号或"收入"/"支出"标识）
        const amountResult = this.parseAmount(amountStr);
        if (!amountResult) {
          skippedCount++;
          continue;
        }

        const { amount, type } = amountResult;
        if (amount === 0) {
          skippedCount++;
          continue;
        }

        const date = this.parseDate(dateStr);
        const merchant = this.extractMerchant(summary);

        transactions.push({
          date,
          amount: Math.abs(amount),
          type,
          description: summary || '招商银行交易',
          merchant,
          transactionNo: null,
          paymentMethod: '招商银行',
          status: null,
          raw: line,
        });
      } catch (err) {
        skippedCount++;
        errors.push(`第${i + 1}行解析失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    this.logger.log(`招商银行CSV解析完成: ${transactions.length}条交易, 跳过${skippedCount}条`);
    return { transactions, skippedCount, errors };
  }

  /**
   * 解析文本格式账单（PDF提取后）
   * 招行PDF账单提取后为纯文本，按行解析
   */
  private parseText(text: string): ParseResult {
    const transactions: ParsedTransaction[] = [];
    const errors: string[] = [];
    let skippedCount = 0;

    const lines = text.split(/\r?\n/);

    // 正则匹配日期+金额模式：2024/06/15  某商户消费  -28.00
    const linePattern = /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\s+(.+?)\s+([+\-]?\d+(?:\.\d{1,2})?)/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }

      const match = line.match(linePattern);
      if (!match) {
        continue;
      }

      try {
        const [, dateStr, summary, amountStr] = match;
        const amount = parseFloat(amountStr);

        if (isNaN(amount) || amount === 0) {
          skippedCount++;
          continue;
        }

        // 根据金额正负或摘要关键词判断收支
        let type: 'income' | 'expense';
        if (amount > 0) {
          type = 'income';
        } else if (amount < 0) {
          type = 'expense';
        } else {
          type = this.inferType(summary);
        }

        const date = this.parseDate(dateStr);
        const merchant = this.extractMerchant(summary);

        transactions.push({
          date,
          amount: Math.abs(amount),
          type,
          description: summary.trim(),
          merchant,
          transactionNo: null,
          paymentMethod: '招商银行',
          status: null,
          raw: line,
        });
      } catch (err) {
        skippedCount++;
        errors.push(`文本第${i + 1}行解析失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    this.logger.log(`招商银行文本解析完成: ${transactions.length}条交易, 跳过${skippedCount}条`);
    return { transactions, skippedCount, errors };
  }

  /**
   * 解析金额字符串
   * 招行金额可能格式：
   * - 带正负号：+28.00 / -28.00
   * - 无符号：28.00
   * - 带文字：收入28.00 / 支出28.00
   */
  private parseAmount(amountStr: string): { amount: number; type: 'income' | 'expense' } | null {
    // 去除空格和¥符号
    const cleaned = amountStr.replace(/[\s¥￥,]/g, '');

    // 带文字标识：收入/支出
    if (cleaned.includes('收入') || cleaned.includes('转入')) {
      const num = parseFloat(cleaned.replace(/[^\d.]/g, ''));
      return num ? { amount: num, type: 'income' } : null;
    }

    if (cleaned.includes('支出') || cleaned.includes('转出')) {
      const num = parseFloat(cleaned.replace(/[^\d.]/g, ''));
      return num ? { amount: num, type: 'expense' } : null;
    }

    // 带正负号
    const num = parseFloat(cleaned);
    if (isNaN(num) || num === 0) {
      return null;
    }

    return {
      amount: Math.abs(num),
      type: num > 0 ? 'income' : 'expense',
    };
  }

  /**
   * 根据摘要推断收支类型
   */
  private inferType(summary: string): 'income' | 'expense' {
    if (INCOME_KEYWORDS.some((kw) => summary.includes(kw))) {
      return 'income';
    }
    if (EXPENSE_KEYWORDS.some((kw) => summary.includes(kw))) {
      return 'expense';
    }
    // 默认为支出
    return 'expense';
  }

  /**
   * 从交易摘要中提取商户名
   * 招行摘要格式通常为：商户名/交易类型 或 交易类型/商户名
   */
  private extractMerchant(summary: string): string | null {
    if (!summary) {
      return null;
    }

    // 按斜杠分割，取第一部分作为商户名
    const parts = summary.split('/').map((s) => s.trim());
    if (parts.length > 1) {
      // 如果有多个部分，取第一个非关键词的部分
      for (const part of parts) {
        if (!INCOME_KEYWORDS.some((kw) => part.includes(kw)) &&
            !EXPENSE_KEYWORDS.some((kw) => part.includes(kw))) {
          return part;
        }
      }
    }

    // 去除常见的关键词
    let merchant = summary;
    for (const kw of [...INCOME_KEYWORDS, ...EXPENSE_KEYWORDS]) {
      merchant = merchant.replace(kw, '').trim();
    }

    return merchant || null;
  }

  /**
   * 解析日期
   * 招行格式：2024/06/15 或 2024-06-15
   */
  private parseDate(dateStr: string): Date {
    const match = dateStr.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (match) {
      return new Date(
        parseInt(match[1], 10),
        parseInt(match[2], 10) - 1,
        parseInt(match[3], 10),
      );
    }
    return new Date(dateStr);
  }

  /**
   * 解析行（按逗号或制表符分割）
   */
  private parseLine(line: string): string[] {
    // 先尝试逗号分割
    if (line.includes(',')) {
      return this.parseCSVLine(line);
    }

    // 制表符分割
    if (line.includes('\t')) {
      return line.split('\t').map((s) => s.trim());
    }

    // 多空格分割
    return line.split(/\s{2,}/).map((s) => s.trim());
  }

  /**
   * 解析CSV行
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }
}

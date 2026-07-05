/**
 * 建设银行账单解析器
 * 支持建设银行CSV和文本格式账单
 *
 * 建行账单格式特征：
 * - CSV格式：交易日期,摘要,金额,余额,交易渠道,对方账户
 * - 日期格式：2024-06-15 或 2024/06/15
 * - 金额正负号表示收支
 * - 摘要包含交易类型和商户信息
 */

import { Injectable, Logger } from '@nestjs/common';
import { IBillParser, ParsedTransaction, ParseResult } from './parser.interface';

/** 建行CSV列索引映射 */
const CCB_CSV_COLUMNS = {
  date: 0,           // 交易日期
  summary: 1,        // 摘要
  amount: 2,         // 金额
  balance: 3,        // 余额
  channel: 4,        // 交易渠道
  counterparty: 5,   // 对方账户
} as const;

/** 收入关键词 */
const INCOME_KEYWORDS = ['工资', '汇入', '转入', '存入', '利息', '收益', '退款', '代发', '收入', '存现'];

/** 支出关键词 */
const EXPENSE_KEYWORDS = ['消费', '汇出', '转出', '取款', '取现', '缴费', '支付', '扣款', '支出', '网购'];

@Injectable()
export class CcbParser implements IBillParser {
  private readonly logger = new Logger(CcbParser.name);
  readonly platform = 'ccb';

  /**
   * 解析建设银行账单文件
   * @param buffer 文件内容
   * @returns 解析结果
   */
  parse(buffer: Buffer): ParseResult {
    const text = buffer.toString('utf8');

    if (text.includes('交易日期') || text.includes('记账日期')) {
      return this.parseCSV(text);
    }

    return this.parseText(text);
  }

  /**
   * 解析CSV格式
   */
  private parseCSV(text: string): ParseResult {
    const transactions: ParsedTransaction[] = [];
    const errors: string[] = [];
    let skippedCount = 0;

    const lines = text.split(/\r?\n/);

    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('交易日期') || lines[i].includes('记账日期')) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      errors.push('未找到建设银行CSV列标题行');
      return { transactions, skippedCount, errors };
    }

    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('-')) {
        continue;
      }

      if (line.includes('期初') || line.includes('期末') || line.includes('合计') || line.includes('账户余额')) {
        skippedCount++;
        continue;
      }

      try {
        const cols = this.parseCSVLine(line);

        if (cols.length < 3) {
          skippedCount++;
          continue;
        }

        const dateStr = (cols[CCB_CSV_COLUMNS.date] || '').trim();
        const summary = (cols[CCB_CSV_COLUMNS.summary] || '').trim();
        const amountStr = (cols[CCB_CSV_COLUMNS.amount] || '').trim();

        if (!dateStr || !amountStr) {
          skippedCount++;
          continue;
        }

        const amount = parseFloat(amountStr.replace(/[\s¥￥,]/g, ''));
        if (isNaN(amount) || amount === 0) {
          skippedCount++;
          continue;
        }

        const type: 'income' | 'expense' = amount > 0 ? 'income' : 'expense';
        const date = this.parseDate(dateStr);
        const counterparty = (cols[CCB_CSV_COLUMNS.counterparty] || '').trim();
        const merchant = counterparty || this.extractMerchant(summary);
        const channel = (cols[CCB_CSV_COLUMNS.channel] || '').trim() || null;

        transactions.push({
          date,
          amount: Math.abs(amount),
          type,
          description: summary || '建设银行交易',
          merchant: merchant || null,
          transactionNo: null,
          paymentMethod: channel || '建设银行',
          status: null,
          raw: line,
        });
      } catch (err) {
        skippedCount++;
        errors.push(`第${i + 1}行解析失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    this.logger.log(`建设银行CSV解析完成: ${transactions.length}条交易, 跳过${skippedCount}条`);
    return { transactions, skippedCount, errors };
  }

  /**
   * 解析文本格式（PDF提取后）
   */
  private parseText(text: string): ParseResult {
    const transactions: ParsedTransaction[] = [];
    const errors: string[] = [];
    let skippedCount = 0;

    const lines = text.split(/\r?\n/);

    // 正则匹配：日期 摘要 金额
    const linePattern = /(\d{4}[\-\/]\d{1,2}[\-\/]\d{1,2})\s+(.+?)\s+([+\-]?\d+(?:\.\d{1,2})?)/;

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

        const type: 'income' | 'expense' = amount > 0 ? 'income' : 'expense';
        const date = this.parseDate(dateStr);
        const merchant = this.extractMerchant(summary);

        transactions.push({
          date,
          amount: Math.abs(amount),
          type,
          description: summary.trim(),
          merchant,
          transactionNo: null,
          paymentMethod: '建设银行',
          status: null,
          raw: line,
        });
      } catch (err) {
        skippedCount++;
        errors.push(`文本第${i + 1}行解析失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    this.logger.log(`建设银行文本解析完成: ${transactions.length}条交易, 跳过${skippedCount}条`);
    return { transactions, skippedCount, errors };
  }

  /**
   * 从摘要中提取商户名
   */
  private extractMerchant(summary: string): string | null {
    if (!summary) {
      return null;
    }

    let merchant = summary;

    for (const kw of [...INCOME_KEYWORDS, ...EXPENSE_KEYWORDS]) {
      merchant = merchant.replace(kw, '').trim();
    }

    merchant = merchant.replace(/[\-\/\[\]（）()【】{}]/g, '').trim();

    return merchant || null;
  }

  /**
   * 解析日期
   */
  private parseDate(dateStr: string): Date {
    const match = dateStr.match(/(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})/);
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

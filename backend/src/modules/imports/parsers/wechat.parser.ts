/**
 * 微信账单解析器
 * 支持微信支付CSV格式账单
 *
 * 微信CSV格式特征：
 * - 文件开头有UTF-8 BOM或GBK编码
 * - 头部有说明行：微信支付账单明细
 * - 列标题行：交易时间,交易类型,交易对方,商品,金额(元),收/支,支付方式,当前状态,交易单号,商户单号,备注
 * - 金额格式：¥28.00 或 支出¥28.00
 * - 需要过滤"已全额退款"、"已退款"等记录
 *
 * 编码处理：
 * - 微信CSV通常是UTF-8 BOM编码，但也可能是GBK
 */

import { Injectable, Logger } from '@nestjs/common';
import * as iconv from 'iconv-lite';
import { IBillParser, ParsedTransaction, ParseResult } from './parser.interface';

/** 微信CSV列索引映射 */
const WECHAT_CSV_COLUMNS = {
  transactionTime: 0,   // 交易时间
  transactionType: 1,   // 交易类型
  counterparty: 2,      // 交易对方
  goods: 3,             // 商品
  amount: 4,            // 金额(元)
  direction: 5,         // 收/支
  paymentMethod: 6,     // 支付方式
  status: 7,            // 当前状态
  transactionNo: 8,     // 交易单号
  merchantOrderNo: 9,   // 商户单号
  remark: 10,           // 备注
} as const;

/** 需要过滤的状态 */
const INVALID_STATUSES = ['已全额退款', '已退款', '交易关闭'];

@Injectable()
export class WechatParser implements IBillParser {
  private readonly logger = new Logger(WechatParser.name);
  readonly platform = 'wechat';

  /**
   * 解析微信账单文件
   * @param buffer 文件内容
   * @returns 解析结果
   */
  parse(buffer: Buffer): ParseResult {
    const transactions: ParsedTransaction[] = [];
    const errors: string[] = [];
    let skippedCount = 0;

    const text = this.decodeBuffer(buffer);
    const lines = text.split(/\r?\n/);

    // 找到列标题行（包含"交易时间"和"交易对方"的行）
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('交易时间') && lines[i].includes('交易对方')) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      errors.push('未找到微信CSV列标题行，可能格式不正确');
      return { transactions, skippedCount, errors };
    }

    // 从标题行下一行开始解析
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();

      // 跳过空行
      if (!line) {
        continue;
      }

      // 跳过尾部汇总信息
      if (line.includes('导出类型') || line.includes('共') || line.includes('筛选条件')) {
        skippedCount++;
        continue;
      }

      try {
        const cols = this.parseCSVLine(line);

        if (cols.length < 8) {
          skippedCount++;
          continue;
        }

        const status = (cols[WECHAT_CSV_COLUMNS.status] || '').trim();

        // 过滤退款和关闭的记录
        if (INVALID_STATUSES.some((s) => status.includes(s))) {
          skippedCount++;
          continue;
        }

        const direction = (cols[WECHAT_CSV_COLUMNS.direction] || '').trim();

        // 跳过 "/" 方向（不计收支）
        if (!direction || direction === '/') {
          skippedCount++;
          continue;
        }

        // 解析金额（微信格式：¥28.00 或 支出¥28.00）
        const amountStr = (cols[WECHAT_CSV_COLUMNS.amount] || '').trim();
        const amountMatch = amountStr.match(/[\d.]+/);
        if (!amountMatch) {
          skippedCount++;
          continue;
        }

        const amount = parseFloat(amountMatch[0]);
        if (isNaN(amount) || amount === 0) {
          skippedCount++;
          continue;
        }

        // 确定收支类型
        const type: 'income' | 'expense' = direction.includes('支出') ? 'expense' : 'income';

        // 解析日期（微信格式：2024-06-15 10:30:00）
        const dateStr = (cols[WECHAT_CSV_COLUMNS.transactionTime] || '').trim();
        const date = this.parseDate(dateStr);

        // 提取交易对方和商品
        const counterparty = (cols[WECHAT_CSV_COLUMNS.counterparty] || '').trim();
        const goods = (cols[WECHAT_CSV_COLUMNS.goods] || '').trim();
        const transactionType = (cols[WECHAT_CSV_COLUMNS.transactionType] || '').trim();

        // 商户名优先使用交易对方
        const merchant = counterparty || goods || null;

        // 描述：商品 + 交易类型
        const remark = (cols[WECHAT_CSV_COLUMNS.remark] || '').trim();
        const description = [goods, transactionType, remark].filter(Boolean).join(' ') || counterparty || '微信交易';

        const transactionNo = (cols[WECHAT_CSV_COLUMNS.transactionNo] || '').trim() || null;
        const paymentMethod = (cols[WECHAT_CSV_COLUMNS.paymentMethod] || '').trim() || null;

        transactions.push({
          date,
          amount: Math.abs(amount),
          type,
          description,
          merchant,
          transactionNo,
          paymentMethod,
          status: status || null,
          raw: line,
        });
      } catch (err) {
        skippedCount++;
        errors.push(`第${i + 1}行解析失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    this.logger.log(`微信CSV解析完成: ${transactions.length}条交易, 跳过${skippedCount}条`);
    return { transactions, skippedCount, errors };
  }

  /**
   * 解析CSV行（处理引号包裹的字段）
   * 微信CSV使用逗号分隔，字段用双引号包裹
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

  /**
   * 解析日期字符串
   * 微信格式：2024-06-15 10:30:00
   */
  private parseDate(dateStr: string): Date {
    if (!dateStr) {
      return new Date();
    }

    const match = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}):(\d{1,2}))?/);
    if (match) {
      const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
      return new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        parseInt(hour, 10),
        parseInt(minute, 10),
        parseInt(second, 10),
      );
    }

    return new Date(dateStr);
  }

  /**
   * 解码Buffer
   * 微信CSV通常是UTF-8 BOM编码，也可能是GBK
   */
  private decodeBuffer(buffer: Buffer): string {
    // 检查UTF-8 BOM（微信账单通常有BOM）
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      return buffer.toString('utf8', 3);
    }

    // 检查GBK BOM
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
      return iconv.decode(buffer, 'utf16le');
    }

    // 尝试UTF-8解码
    const utf8Text = buffer.toString('utf8');
    if (utf8Text.includes('交易时间') || utf8Text.includes('微信支付')) {
      return utf8Text;
    }

    // 尝试GBK解码
    try {
      const gbkText = iconv.decode(buffer, 'gbk');
      if (gbkText.includes('交易时间') || gbkText.includes('微信支付')) {
        return gbkText;
      }
    } catch {
      // GBK解码失败
    }

    return utf8Text;
  }
}

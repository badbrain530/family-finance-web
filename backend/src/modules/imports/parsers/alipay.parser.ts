/**
 * 支付宝账单解析器
 * 支持支付宝CSV和HTML格式账单
 *
 * 支付宝CSV格式特征：
 * - 文件头部有多行说明信息（-----------------------------------分隔）
 * - 列标题行：交易号,商家订单号,交易创建时间,付款时间,最近修改时间,交易来源地,类型,交易对方,商品名称,金额（元）,收/支,交易状态,服务费（元）,成功退款（元）,备注,资金状态
 * - 金额为正数，收/支列标识方向
 * - 交易状态为"交易成功"的才需要导入
 *
 * 编码处理：
 * - 支付宝CSV可能是GBK或UTF-8编码，使用iconv-lite自动检测
 */

import { Injectable, Logger } from '@nestjs/common';
import * as iconv from 'iconv-lite';
import * as cheerio from 'cheerio';
import { IBillParser, ParsedTransaction, ParseResult } from './parser.interface';

/** 支付宝CSV列索引映射（标准格式） */
const ALIPAY_CSV_COLUMNS = {
  transactionNo: 0,       // 交易号
  orderNo: 1,             // 商家订单号
  createTime: 2,          // 交易创建时间
  payTime: 3,             // 付款时间
  modifyTime: 4,          // 最近修改时间
  source: 5,              // 交易来源地
  type: 6,                // 类型
  counterparty: 7,        // 交易对方
  goodsName: 8,           // 商品名称
  amount: 9,              // 金额（元）
  direction: 10,          // 收/支
  status: 11,             // 交易状态
  serviceFee: 12,         // 服务费（元）
  refundAmount: 13,       // 成功退款（元）
  remark: 14,             // 备注
  fundStatus: 15,         // 资金状态
} as const;

/** 需要过滤的非交易状态 */
const INVALID_STATUSES = ['交易关闭', '等待付款', '已删除'];

@Injectable()
export class AlipayParser implements IBillParser {
  private readonly logger = new Logger(AlipayParser.name);
  readonly platform = 'alipay';

  /**
   * 解析支付宝账单文件
   * 自动检测CSV或HTML格式
   * @param buffer 文件内容
   * @returns 解析结果
   */
  parse(buffer: Buffer): ParseResult {
    // 尝试将Buffer转为字符串，检测格式
    const text = this.decodeBuffer(buffer);

    // 判断是HTML还是CSV
  if (text.includes('<html') || text.includes('<table')) {
      return this.parseHTML(text);
    }

    return this.parseCSV(text);
  }

  /**
   * 解析CSV格式账单
   * 支付宝CSV有头部说明行，需要跳过到列标题行
   */
  private parseCSV(text: string): ParseResult {
    const transactions: ParsedTransaction[] = [];
    const errors: string[] = [];
    let skippedCount = 0;

    // 按行分割
    const lines = text.split(/\r?\n/);

    // 找到列标题行（包含"交易号"的行）
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('交易号') && lines[i].includes('交易对方')) {
        headerIndex = i;
        break;
      }
    }

    if (headerIndex === -1) {
      errors.push('未找到支付宝CSV列标题行，可能格式不正确');
      return { transactions, skippedCount, errors };
    }

    // 从标题行下一行开始解析数据
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();

      // 跳过空行和分隔线
      if (!line || line.startsWith('-') || line.startsWith('---')) {
        continue;
      }

      // 跳过尾部汇总信息
      if (line.includes('本期账单') || line.includes('账单周期') || line.includes('汇总')) {
        skippedCount++;
        continue;
      }

      try {
        const cols = this.parseCSVLine(line);

        if (cols.length < 12) {
          skippedCount++;
          continue;
        }

        const status = (cols[ALIPAY_CSV_COLUMNS.status] || '').trim();

        // 过滤非成功交易
        if (INVALID_STATUSES.some((s) => status.includes(s))) {
          skippedCount++;
          continue;
        }

        // 只导入"交易成功"或包含"成功"的记录
        if (!status.includes('成功') && !status.includes('已完成')) {
          skippedCount++;
          continue;
        }

        const direction = (cols[ALIPAY_CSV_COLUMNS.direction] || '').trim();
        const amountStr = (cols[ALIPAY_CSV_COLUMNS.amount] || '').trim();

        // 跳过收支方向为空的记录（如"不计收支"）
        if (!direction || direction === '不计收支' || direction === '') {
          skippedCount++;
          continue;
        }

        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount === 0) {
          skippedCount++;
          continue;
        }

        // 确定收支类型
        const type: 'income' | 'expense' = direction.includes('支出') ? 'expense' : 'income';

        // 解析日期（支付宝格式：2024-06-15 10:30:00）
        const dateStr = (cols[ALIPAY_CSV_COLUMNS.payTime] || cols[ALIPAY_CSV_COLUMNS.createTime] || '').trim();
        const date = this.parseDate(dateStr);

        // 提取商户/交易对方
        const counterparty = (cols[ALIPAY_CSV_COLUMNS.counterparty] || '').trim();
        const goodsName = (cols[ALIPAY_CSV_COLUMNS.goodsName] || '').trim();

        // 商户名优先使用交易对方，其次商品名称
        const merchant = counterparty || goodsName || null;

        // 描述：商品名称 + 备注
        const remark = (cols[ALIPAY_CSV_COLUMNS.remark] || '').trim();
        const description = [goodsName, remark].filter(Boolean).join(' ') || counterparty || '支付宝交易';

        const transactionNo = (cols[ALIPAY_CSV_COLUMNS.transactionNo] || '').trim() || null;

        transactions.push({
          date,
          amount: Math.abs(amount),
          type,
          description,
          merchant,
          transactionNo,
          paymentMethod: (cols[ALIPAY_CSV_COLUMNS.source] || '').trim() || null,
          status: status || null,
          raw: line,
        });
      } catch (err) {
        skippedCount++;
        errors.push(`第${i + 1}行解析失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    this.logger.log(`支付宝CSV解析完成: ${transactions.length}条交易, 跳过${skippedCount}条`);
    return { transactions, skippedCount, errors };
  }

  /**
   * 解析HTML格式账单
   * 支付宝HTML账单使用table展示交易记录
   */
  private parseHTML(html: string): ParseResult {
    const transactions: ParsedTransaction[] = [];
    const errors: string[] = [];
    let skippedCount = 0;

    try {
      const $ = cheerio.load(html);

      // 找到交易记录表格
      $('table tr').each((_, elem) => {
        const cells: string[] = [];
        $(elem)
          .find('td')
          .each((_, cell) => {
            cells.push($(cell).text().trim());
          });

        if (cells.length < 10) {
          return; // 跳过表头和非数据行
        }

        try {
          const status = cells[11] || '';
          if (INVALID_STATUSES.some((s) => status.includes(s))) {
            skippedCount++;
            return;
          }

          if (!status.includes('成功') && !status.includes('已完成')) {
            skippedCount++;
            return;
          }

          const direction = (cells[10] || '').trim();
          if (!direction || direction === '不计收支') {
            skippedCount++;
            return;
          }

          const amount = parseFloat((cells[9] || '').trim());
          if (isNaN(amount) || amount === 0) {
            skippedCount++;
            return;
          }

          const type: 'income' | 'expense' = direction.includes('支出') ? 'expense' : 'income';
          const dateStr = (cells[3] || cells[2] || '').trim();
          const date = this.parseDate(dateStr);
          const counterparty = (cells[7] || '').trim();
          const goodsName = (cells[8] || '').trim();
          const merchant = counterparty || goodsName || null;

          transactions.push({
            date,
            amount: Math.abs(amount),
            type,
            description: goodsName || counterparty || '支付宝交易',
            merchant,
            transactionNo: (cells[0] || '').trim() || null,
            paymentMethod: (cells[5] || '').trim() || null,
            status: status || null,
          });
        } catch (err) {
          skippedCount++;
          errors.push(`HTML行解析失败: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
    } catch (err) {
      errors.push(`HTML解析失败: ${err instanceof Error ? err.message : String(err)}`);
    }

    this.logger.log(`支付宝HTML解析完成: ${transactions.length}条交易, 跳过${skippedCount}条`);
    return { transactions, skippedCount, errors };
  }

  /**
   * 解析CSV行（处理引号包裹的字段）
   * 支付宝CSV使用逗号分隔，字段可能用双引号包裹
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        // 处理双引号转义（""表示一个"）
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
   * 支付宝格式：2024-06-15 10:30:00
   */
  private parseDate(dateStr: string): Date {
    if (!dateStr) {
      return new Date();
    }

    // 标准格式：YYYY-MM-DD HH:mm:ss
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
   * 支付宝CSV可能是GBK或UTF-8编码
   * 检测BOM和编码特征
   */
  private decodeBuffer(buffer: Buffer): string {
    // 检查UTF-8 BOM
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      return buffer.toString('utf8', 3);
    }

    // 检查是否是UTF-8编码（尝试解码，如果包含常见UTF-8中文则认为正确）
    const utf8Text = buffer.toString('utf8');
    if (utf8Text.includes('交易号') || utf8Text.includes('支付宝')) {
      return utf8Text;
    }

    // 尝试GBK解码
    try {
      const gbkText = iconv.decode(buffer, 'gbk');
      if (gbkText.includes('交易号') || gbkText.includes('支付宝')) {
        return gbkText;
      }
    } catch {
      // GBK解码失败，返回UTF-8
    }

    return utf8Text;
  }
}

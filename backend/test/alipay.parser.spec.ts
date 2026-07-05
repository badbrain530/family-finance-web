import { AlipayParser } from '../src/modules/imports/parsers/alipay.parser';
import { ParseResult } from '../src/modules/imports/parsers/parser.interface';

describe('AlipayParser', () => {
  let parser: AlipayParser;

  beforeEach(() => {
    parser = new AlipayParser();
  });

  describe('platform', () => {
    it('should have platform identifier "alipay"', () => {
      expect(parser.platform).toBe('alipay');
    });
  });

  describe('parse - CSV format', () => {
    /**
     * 构造支付宝CSV格式测试数据
     * 支付宝CSV特征：
     * - 头部有说明信息
     * - 列标题行包含"交易号"和"交易对方"
     * - 数据行使用逗号分隔
     */
    function createAlipayCSV(transactions: string[]): string {
      const header = [
        '-----------------------------------',
        '支付宝账单',
        '-----------------------------------',
        '交易号,商家订单号,交易创建时间,付款时间,最近修改时间,交易来源地,类型,交易对方,商品名称,金额（元）,收/支,交易状态,服务费（元）,成功退款（元）,备注,资金状态',
      ];
      const footer = [
        '-----------------------------------',
        '本期账单汇总',
        '-----------------------------------',
      ];
      return [...header, ...transactions, ...footer].join('\n');
    }

    it('should parse a valid expense transaction', () => {
      const csv = createAlipayCSV([
        '2024061510001,ORDER001,2024-06-15 10:30:00,2024-06-15 10:30:00,2024-06-15 10:31:00,支付宝App,即时到账,美团外卖,午餐,35.50,支出,交易成功,0.00,0.00,,资金已到账',
      ]);

      const result = parser.parse(Buffer.from(csv, 'utf8'));

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(35.5);
      expect(result.transactions[0].type).toBe('expense');
      expect(result.transactions[0].merchant).toBe('美团外卖');
      expect(result.transactions[0].description).toContain('午餐');
      expect(result.transactions[0].transactionNo).toBe('2024061510001');
      expect(result.errors).toHaveLength(0);
    });

    it('should parse a valid income transaction', () => {
      const csv = createAlipayCSV([
        '2024061510002,ORDER002,2024-06-15 12:00:00,2024-06-15 12:00:00,2024-06-15 12:01:00,支付宝App,转账,张三,退款,500.00,收入,交易成功,0.00,0.00,,资金已到账',
      ]);

      const result = parser.parse(Buffer.from(csv, 'utf8'));

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(500);
      expect(result.transactions[0].type).toBe('income');
    });

    it('should skip transactions with invalid status (交易关闭)', () => {
      const csv = createAlipayCSV([
        '2024061510003,ORDER003,2024-06-15 10:30:00,2024-06-15 10:30:00,2024-06-15 10:31:00,支付宝App,即时到账,商户A,商品A,50.00,支出,交易关闭,0.00,0.00,,资金未到账',
      ]);

      const result = parser.parse(Buffer.from(csv, 'utf8'));

      expect(result.transactions).toHaveLength(0);
      expect(result.skippedCount).toBeGreaterThanOrEqual(1);
    });

    it('should skip transactions with status 等待付款', () => {
      const csv = createAlipayCSV([
        '2024061510004,ORDER004,2024-06-15 10:30:00,2024-06-15 10:30:00,2024-06-15 10:31:00,支付宝App,即时到账,商户B,商品B,100.00,支出,等待付款,0.00,0.00,,资金未到账',
      ]);

      const result = parser.parse(Buffer.from(csv, 'utf8'));

      expect(result.transactions).toHaveLength(0);
    });

    it('should skip transactions with empty direction (不计收支)', () => {
      const csv = createAlipayCSV([
        '2024061510005,ORDER005,2024-06-15 10:30:00,2024-06-15 10:30:00,2024-06-15 10:31:00,支付宝App,即时到账,商户C,商品C,50.00,不计收支,交易成功,0.00,0.00,,资金已到账',
      ]);

      const result = parser.parse(Buffer.from(csv, 'utf8'));

      expect(result.transactions).toHaveLength(0);
      expect(result.skippedCount).toBeGreaterThanOrEqual(1);
    });

    it('should skip transactions with zero amount', () => {
      const csv = createAlipayCSV([
        '2024061510006,ORDER006,2024-06-15 10:30:00,2024-06-15 10:30:00,2024-06-15 10:31:00,支付宝App,即时到账,商户D,商品D,0.00,支出,交易成功,0.00,0.00,,资金已到账',
      ]);

      const result = parser.parse(Buffer.from(csv, 'utf8'));

      expect(result.transactions).toHaveLength(0);
    });

    it('should parse multiple transactions', () => {
      const csv = createAlipayCSV([
        '2024061510007,ORDER007,2024-06-15 08:00:00,2024-06-15 08:00:00,2024-06-15 08:01:00,支付宝App,即时到账,早餐店,早餐,15.00,支出,交易成功,0.00,0.00,,资金已到账',
        '2024061510008,ORDER008,2024-06-15 12:00:00,2024-06-15 12:00:00,2024-06-15 12:01:00,支付宝App,即时到账,午餐店,午餐,28.00,支出,交易成功,0.00,0.00,,资金已到账',
        '2024061510009,ORDER009,2024-06-15 18:00:00,2024-06-15 18:00:00,2024-06-15 18:01:00,支付宝App,即时到账,超市,日用品,99.50,支出,交易成功,0.00,0.00,,资金已到账',
      ]);

      const result = parser.parse(Buffer.from(csv, 'utf8'));

      expect(result.transactions).toHaveLength(3);
      expect(result.transactions[0].amount).toBe(15);
      expect(result.transactions[1].amount).toBe(28);
      expect(result.transactions[2].amount).toBe(99.5);
    });

    it('should return error when header row not found', () => {
      const csv = 'some random text\nwithout proper headers\n';

      const result = parser.parse(Buffer.from(csv, 'utf8'));

      expect(result.transactions).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('列标题行');
    });

    it('should parse date correctly (YYYY-MM-DD HH:mm:ss)', () => {
      const csv = createAlipayCSV([
        '2024061510010,ORDER010,2024-06-15 10:30:00,2024-06-15 10:30:00,2024-06-15 10:31:00,支付宝App,即时到账,商户E,商品E,50.00,支出,交易成功,0.00,0.00,,资金已到账',
      ]);

      const result = parser.parse(Buffer.from(csv, 'utf8'));

      expect(result.transactions[0].date.getFullYear()).toBe(2024);
      expect(result.transactions[0].date.getMonth()).toBe(5); // June = 5 (0-indexed)
      expect(result.transactions[0].date.getDate()).toBe(15);
      expect(result.transactions[0].date.getHours()).toBe(10);
      expect(result.transactions[0].date.getMinutes()).toBe(30);
    });

    it('should handle CSV fields with double quotes', () => {
      const csv = createAlipayCSV([
        '2024061510011,ORDER011,2024-06-15 10:30:00,2024-06-15 10:30:00,2024-06-15 10:31:00,支付宝App,即时到账,"商户,F","商品,F",50.00,支出,交易成功,0.00,0.00,,资金已到账',
      ]);

      const result = parser.parse(Buffer.from(csv, 'utf8'));

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].merchant).toBe('商户,F');
    });

    it('should use counterparty as merchant when available', () => {
      const csv = createAlipayCSV([
        '2024061510012,ORDER012,2024-06-15 10:30:00,2024-06-15 10:30:00,2024-06-15 10:31:00,支付宝App,即时到账,星巴克,咖啡,38.00,支出,交易成功,0.00,0.00,,资金已到账',
      ]);

      const result = parser.parse(Buffer.from(csv, 'utf8'));

      expect(result.transactions[0].merchant).toBe('星巴克');
    });

    it('should use goodsName as merchant when counterparty is empty', () => {
      const csv = createAlipayCSV([
        '2024061510013,ORDER013,2024-06-15 10:30:00,2024-06-15 10:30:00,2024-06-15 10:31:00,支付宝App,即时到账,,某商品,50.00,支出,交易成功,0.00,0.00,,资金已到账',
      ]);

      const result = parser.parse(Buffer.from(csv, 'utf8'));

      expect(result.transactions[0].merchant).toBe('某商品');
    });

    it('should use absolute value for amount', () => {
      const csv = createAlipayCSV([
        '2024061510014,ORDER014,2024-06-15 10:30:00,2024-06-15 10:30:00,2024-06-15 10:31:00,支付宝App,即时到账,商户G,商品G,-50.00,支出,交易成功,0.00,0.00,,资金已到账',
      ]);

      const result = parser.parse(Buffer.from(csv, 'utf8'));

      expect(result.transactions[0].amount).toBe(50);
    });

    it('should skip footer summary lines', () => {
      const csv = [
        '-----------------------------------',
        '支付宝账单',
        '-----------------------------------',
        '交易号,商家订单号,交易创建时间,付款时间,最近修改时间,交易来源地,类型,交易对方,商品名称,金额（元）,收/支,交易状态,服务费（元）,成功退款（元）,备注,资金状态',
        '2024061510015,ORDER015,2024-06-15 10:30:00,2024-06-15 10:30:00,2024-06-15 10:31:00,支付宝App,即时到账,商户H,商品H,50.00,支出,交易成功,0.00,0.00,,资金已到账',
        '本期账单汇总信息',
        '账单周期：2024-06-01 至 2024-06-30',
      ].join('\n');

      const result = parser.parse(Buffer.from(csv, 'utf8'));

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(50);
    });
  });

  describe('parse - HTML format', () => {
    it('should parse HTML table format', () => {
      const html = `
        <html>
        <body>
          <table>
            <tr><th>交易号</th><th>商家订单号</th><th>创建时间</th><th>付款时间</th><th>修改时间</th><th>来源</th><th>类型</th><th>交易对方</th><th>商品名称</th><th>金额</th><th>收/支</th><th>交易状态</th><th>服务费</th><th>退款</th><th>备注</th><th>资金状态</th></tr>
            <tr>
              <td>2024061510016</td>
              <td>ORDER016</td>
              <td>2024-06-15 10:30:00</td>
              <td>2024-06-15 10:30:00</td>
              <td>2024-06-15 10:31:00</td>
              <td>支付宝App</td>
              <td>即时到账</td>
              <td>美团外卖</td>
              <td>午餐</td>
              <td>35.50</td>
              <td>支出</td>
              <td>交易成功</td>
              <td>0.00</td>
              <td>0.00</td>
              <td></td>
              <td>资金已到账</td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const result = parser.parse(Buffer.from(html, 'utf8'));

      expect(result.transactions.length).toBeGreaterThanOrEqual(1);
      const txn = result.transactions.find((t) => t.merchant === '美团外卖');
      expect(txn).toBeDefined();
      expect(txn!.amount).toBe(35.5);
      expect(txn!.type).toBe('expense');
    });
  });

  describe('parse - edge cases', () => {
    it('should handle empty buffer', () => {
      const result = parser.parse(Buffer.from('', 'utf8'));

      expect(result.transactions).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle buffer with only whitespace', () => {
      const result = parser.parse(Buffer.from('   \n  \n  ', 'utf8'));

      expect(result.transactions).toHaveLength(0);
    });

    it('should detect UTF-8 BOM', () => {
      const csvWithBOM = '\ufeff' + [
        '交易号,商家订单号,交易创建时间,付款时间,最近修改时间,交易来源地,类型,交易对方,商品名称,金额（元）,收/支,交易状态,服务费（元）,成功退款（元）,备注,资金状态',
        '2024061510017,ORDER017,2024-06-15 10:30:00,2024-06-15 10:30:00,2024-06-15 10:31:00,支付宝App,即时到账,商户I,商品I,50.00,支出,交易成功,0.00,0.00,,资金已到账',
      ].join('\n');

      const result = parser.parse(Buffer.from(csvWithBOM, 'utf8'));

      expect(result.transactions).toHaveLength(1);
    });
  });
});

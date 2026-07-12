import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from '../src/modules/transactions/transactions.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { LedgersService } from '../src/modules/ledgers/ledgers.service';
import { CategoriesService } from '../src/modules/categories/categories.service';
import { FamiliesService } from '../src/modules/families/families.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';

/**
 * 交易服务二期核心逻辑测试（退款 / 分期 / 报销）
 * 不连真实库：PrismaService 与依赖服务全部 mock。
 * 覆盖 6 焦点中的：
 *  焦点1 退款不超原额 + 状态机（NONE→PARTIAL→FULL）+ 反向 INCOME 带 refundOfId + 余额以收入(+)调整
 *  焦点3 分期总额（末期校正使 N 期求和精确等于 totalAmount）
 *  模块6 报销（markReimbursement / confirmReimbursement 反向 INCOME 带 reimbursementOfId / cancelReimbursement）
 */
describe('TransactionsService Phase2（退款/分期/报销）', () => {
  let service: TransactionsService;
  let prisma: any;
  let ledgers: any;
  let categories: any;
  let families: any;
  let events: any;

  const ORIGINAL = (over: any = {}) => ({
    id: 't1',
    type: 'EXPENSE',
    amount: 100,
    refundedAmount: 0,
    accountId: 'a1',
    ledgerId: 'ledger-1',
    categoryId: null,
    merchant: '商店',
    note: '购物',
    currency: null,
    reimbursementStatus: 'NONE',
    metadata: undefined,
    ledger: { familyId: 'family-1' },
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      transaction: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      account: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      category: { findUnique: jest.fn() },
    };
    ledgers = { getLedger: jest.fn().mockResolvedValue({ id: 'ledger-1', familyId: 'family-1' }) };
    categories = { matchCategoryByKeyword: jest.fn() };
    families = { validateFamilyMember: jest.fn().mockResolvedValue(true) };
    events = { emit: jest.fn() };

    // 账户 findUnique 按 select 返回不同字段（createTransaction 校验 vs adjustAccountBalance）
    prisma.account.findUnique.mockImplementation((args: any) => {
      if (args?.select?.familyId) return Promise.resolve({ familyId: 'family-1' });
      if (args?.select?.type) return Promise.resolve({ type: 'DEBIT', balance: 1000, creditLimit: null });
      return Promise.resolve({});
    });
    prisma.account.update.mockResolvedValue({});
    // create 回显 data（含 id），adjustAccountBalance 据此读取 type/amount
    prisma.transaction.create.mockImplementation((args: any) =>
      Promise.resolve({ id: 'new-tx', ...args.data }),
    );
    // update 回显 data（用于退款/报销写回状态）
    prisma.transaction.update.mockImplementation((args: any) =>
      Promise.resolve({ id: 'upd-tx', ...args.data }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LedgersService, useValue: ledgers },
        { provide: CategoriesService, useValue: categories },
        { provide: FamiliesService, useValue: families },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = module.get(TransactionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== 焦点1：退款不超原额 + 状态机 ====================
  describe('refund 退款', () => {
    it('部分退款成功：生成反向 INCOME 带 refundOfId，状态机 PARTIAL，余额以收入(+)调整', async () => {
      prisma.transaction.findUnique.mockResolvedValue(ORIGINAL());
      const res: any = await service.refund('t1', 'u1', {
        amount: 30,
        date: '2024-01-02T00:00:00Z',
      } as any);

      // 状态机 PARTIAL + 累计 30
      expect(res.original.refundStatus).toBe('PARTIAL');
      expect(res.original.refundedAmount).toBe(30);

      // 反向 INCOME 交易带 refundOfId
      const createCall = prisma.transaction.create.mock.calls[0][0];
      expect(createCall.data.type).toBe('INCOME');
      expect(createCall.data.refundOfId).toBe('t1');

      // 余额以收入(+)调整：account.update 收到 balance = 1000 + 30
      const updCall = prisma.account.update.mock.calls[0][0];
      expect(updCall.data.balance).toBe(1030);
    });

    it('累计退款不超原额：已退30再退80（110>100）抛 BadRequestException', async () => {
      prisma.transaction.findUnique.mockResolvedValue(ORIGINAL({ refundedAmount: 30 }));
      await expect(
        service.refund('t1', 'u1', { amount: 80, date: '2024-01-02T00:00:00Z' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('边界：恰好退满原额 → FULL，累计等于原额', async () => {
      prisma.transaction.findUnique.mockResolvedValue(ORIGINAL({ refundedAmount: 0 }));
      const res: any = await service.refund('t1', 'u1', {
        amount: 100,
        date: '2024-01-02T00:00:00Z',
      } as any);
      expect(res.original.refundStatus).toBe('FULL');
      expect(res.original.refundedAmount).toBe(100);
    });

    it('状态机 NONE→PARTIAL→FULL：先退60再退40，最终 FULL 且累计精确 100', async () => {
      prisma.transaction.findUnique.mockResolvedValue(ORIGINAL({ refundedAmount: 60 }));
      const res: any = await service.refund('t1', 'u1', {
        amount: 40,
        date: '2024-01-02T00:00:00Z',
      } as any);
      expect(res.original.refundStatus).toBe('FULL');
      expect(res.original.refundedAmount).toBe(100);
    });

    it('部分退款后再超额（+71=101>100）仍抛错，不重复生成反向交易', async () => {
      prisma.transaction.findUnique.mockResolvedValue(ORIGINAL({ refundedAmount: 30 }));
      await expect(
        service.refund('t1', 'u1', { amount: 71, date: '2024-01-02T00:00:00Z' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });

    it('非支出交易不可退款', async () => {
      prisma.transaction.findUnique.mockResolvedValue(ORIGINAL({ type: 'INCOME' }));
      await expect(
        service.refund('t1', 'u1', { amount: 10, date: '2024-01-02T00:00:00Z' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==================== 焦点3：分期总额 ====================
  describe('createInstallment 分期付款', () => {
    it('N 期金额之和精确等于 totalAmount（末期校正，无差1-2分）', async () => {
      const res: any = await service.createInstallment('u1', {
        ledgerId: 'ledger-1',
        accountId: 'a1',
        categoryId: null,
        totalAmount: 1000,
        periods: 3,
        startMonth: '2024-01',
      } as any);

      const amounts = prisma.transaction.create.mock.calls.map((c: any) => c[0].data.amount);
      expect(amounts).toHaveLength(3);
      const sum = Math.round(amounts.reduce((s: number, a: number) => s + a, 0) * 100) / 100;
      expect(sum).toBe(1000);

      // 验证末期校正的具体分配
      expect(amounts[0]).toBe(333.33);
      expect(amounts[1]).toBe(333.33);
      expect(amounts[2]).toBe(333.34);

      // 同组：installmentGroupId 一致、seq 1..3
      const groupIds = new Set(amounts.map(() => true));
      const seqs = prisma.transaction.create.mock.calls
        .map((c: any) => c[0].data.installmentSeq)
        .sort();
      expect(seqs).toEqual([1, 2, 3]);
      const gid = prisma.transaction.create.mock.calls[0][0].data.installmentGroupId;
      prisma.transaction.create.mock.calls.forEach((c: any) =>
        expect(c[0].data.installmentGroupId).toBe(gid),
      );
      expect(prisma.transaction.create.mock.calls[0][0].data.installmentTotal).toBe(3);
      expect(res.groupId).toBe(gid);
    });

    it('大额总额整除不下时，末期抹平（totalAmount=999，periods=4）', async () => {
      const res: any = await service.createInstallment('u1', {
        ledgerId: 'ledger-1',
        accountId: 'a1',
        categoryId: null,
        totalAmount: 999,
        periods: 4,
        startMonth: '2024-01',
      } as any);

      const amounts = prisma.transaction.create.mock.calls.map((c: any) => c[0].data.amount);
      expect(amounts).toHaveLength(4);
      const sum = Math.round(amounts.reduce((s: number, a: number) => s + a, 0) * 100) / 100;
      expect(sum).toBe(999);
      expect(res.transactions).toHaveLength(4);
    });
  });

  // ==================== 模块6：报销 ====================
  describe('reimbursement 报销', () => {
    it('markReimbursement：仅置 PENDING，不生成交易', async () => {
      prisma.transaction.findUnique.mockResolvedValue(ORIGINAL({ reimbursementStatus: 'NONE' }));
      const res: any = await service.markReimbursement('t1', 'u1', { source: 'family' } as any);
      expect(res.reimbursementStatus).toBe('PENDING');
      expect(prisma.transaction.create).not.toHaveBeenCalled();
      expect(prisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reimbursementStatus: 'PENDING' }),
        }),
      );
    });

    it('markReimbursement：已报销不可重复标记', async () => {
      prisma.transaction.findUnique.mockResolvedValue(ORIGINAL({ reimbursementStatus: 'REIMBURSED' }));
      await expect(service.markReimbursement('t1', 'u1', {} as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('confirmReimbursement：生成反向 INCOME 带 reimbursementOfId，原交易置 REIMBURSED', async () => {
      prisma.transaction.findUnique.mockResolvedValue(ORIGINAL({ reimbursementStatus: 'PENDING' }));
      const res: any = await service.confirmReimbursement('t1', 'u1', {
        date: '2024-01-03T00:00:00Z',
        accountId: 'a1',
      } as any);

      const createCall = prisma.transaction.create.mock.calls[0][0];
      expect(createCall.data.type).toBe('INCOME');
      expect(createCall.data.reimbursementOfId).toBe('t1');
      expect(createCall.data.amount).toBe(100);

      expect(prisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reimbursementStatus: 'REIMBURSED' }),
        }),
      );
      expect(res.reimbursement.id).toBe('new-tx');
    });

    it('confirmReimbursement：已报销不可再次确认', async () => {
      prisma.transaction.findUnique.mockResolvedValue(ORIGINAL({ reimbursementStatus: 'REIMBURSED' }));
      await expect(
        service.confirmReimbursement('t1', 'u1', { date: '2024-01-03T00:00:00Z' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('cancelReimbursement：PENDING → NONE', async () => {
      prisma.transaction.findUnique.mockResolvedValue(ORIGINAL({ reimbursementStatus: 'PENDING' }));
      const res: any = await service.cancelReimbursement('t1', 'u1');
      expect(res.reimbursementStatus).toBe('NONE');
      expect(prisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reimbursementStatus: 'NONE' }),
        }),
      );
    });

    it('cancelReimbursement：非 PENDING 状态拒绝', async () => {
      prisma.transaction.findUnique.mockResolvedValue(ORIGINAL({ reimbursementStatus: 'NONE' }));
      await expect(service.cancelReimbursement('t1', 'u1')).rejects.toThrow(BadRequestException);
    });
  });
});

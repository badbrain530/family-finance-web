import { Test, TestingModule } from '@nestjs/testing';
import { AmortizationService } from '../src/modules/amortizations/amortization.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FamiliesService } from '../src/modules/families/families.service';
import { LedgersService } from '../src/modules/ledgers/ledgers.service';
import { TransactionsService } from '../src/modules/transactions/transactions.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * 待摊/预付服务单元测试
 * 覆盖：
 *  - computeAmortizationSchedule 算法：N 期总额精确等于 totalAmount（末期校正）
 *  - generate 生成摊销 EXPENSE（带 amortizationItemId，Net Expense 排除）+ 递减 remaining/isActive
 *  - generate 幂等：已 posted 的计划不再重复生成
 * 不连真实库：PrismaService 与依赖服务全部 mock。
 */
describe('AmortizationService', () => {
  let service: AmortizationService;
  let prisma: any;
  let families: any;
  let ledgers: any;
  let txService: any;
  let events: any;

  beforeEach(async () => {
    prisma = {
      amortizationItem: {
        create: jest.fn().mockResolvedValue({ id: 'item-1' }),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      amortizationSchedule: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    families = { validateFamilyMember: jest.fn().mockResolvedValue(true) };
    ledgers = { getLedger: jest.fn().mockResolvedValue({ id: 'l1', familyId: 'f1' }) };
    txService = { createTransaction: jest.fn().mockResolvedValue({ id: 'gen-tx' }) };
    events = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AmortizationService,
        { provide: PrismaService, useValue: prisma },
        { provide: FamiliesService, useValue: families },
        { provide: LedgersService, useValue: ledgers },
        { provide: TransactionsService, useValue: txService },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = module.get(AmortizationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('computeAmortizationSchedule 算法', () => {
    it('N 期金额之和精确等于 totalAmount（末期校正，无差1-2分）', () => {
      const rows = (service as any).computeAmortizationSchedule({
        totalAmount: 100,
        periodMonths: 3,
        startDate: new Date('2024-01-01'),
      });
      expect(rows).toHaveLength(3);
      const sum = Math.round(rows.reduce((s: number, r: any) => s + r.amount, 0) * 100) / 100;
      expect(sum).toBe(100);
      expect(rows[0].amount).toBe(33.33);
      expect(rows[1].amount).toBe(33.33);
      expect(rows[2].amount).toBe(33.34);
    });

    it('整除不下时末期抹平（total=999，n=4）', () => {
      const rows = (service as any).computeAmortizationSchedule({
        totalAmount: 999,
        periodMonths: 4,
        startDate: new Date('2024-01-01'),
      });
      const sum = Math.round(rows.reduce((s: number, r: any) => s + r.amount, 0) * 100) / 100;
      expect(sum).toBe(999);
      expect(rows).toHaveLength(4);
    });
  });

  describe('generate 生成摊销交易', () => {
    const item = {
      id: 'item-1',
      ledgerId: 'l1',
      accountId: null,
      categoryId: null,
      name: '年度保险费',
      familyId: 'f1',
      remainingAmount: 100,
      amortizedAmount: 0,
      schedules: [{ seq: 1 }, { seq: 2 }],
    };
    const pendingRows = [
      { id: 's1', seq: 1, amount: 50, dueDate: new Date('2024-02-01'), status: 'pending' },
      { id: 's2', seq: 2, amount: 50, dueDate: new Date('2024-03-01'), status: 'pending' },
    ];

    it('为 2 期 pending 生成摊销 EXPENSE（带 amortizationItemId），末期归零 isActive=false', async () => {
      prisma.amortizationItem.findUnique.mockResolvedValue(item);
      prisma.amortizationSchedule.findMany.mockResolvedValue(pendingRows);

      const res: any = await service.generate('item-1', 'u1', { upto: '2024-12-31' } as any);

      expect(res.generated).toBe(2);
      // 2 笔摊销 EXPENSE，均带 amortizationItemId（Net Expense 排除）
      expect(txService.createTransaction).toHaveBeenCalledTimes(2);
      txService.createTransaction.mock.calls.forEach((c: any[]) => {
        expect(c[1].type).toBe('expense');
        expect(c[1].amortizationItemId).toBe('item-1');
      });
      // 每期计划置 posted，写回 generatedTxId
      expect(prisma.amortizationSchedule.update).toHaveBeenCalledTimes(2);
      // item 余额递减：amortizedAmount=100、remainingAmount=0、isActive=false
      expect(prisma.amortizationItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amortizedAmount: 100,
            remainingAmount: 0,
            isActive: false,
          }),
        }),
      );
    });

    it('幂等：已 posted 的计划不再重复生成', async () => {
      prisma.amortizationItem.findUnique.mockResolvedValue(item);
      prisma.amortizationSchedule.findMany.mockResolvedValue([]); // 无 pending

      const res: any = await service.generate('item-1', 'u1', { upto: '2024-12-31' } as any);

      expect(res.generated).toBe(0);
      expect(txService.createTransaction).not.toHaveBeenCalled();
    });
  });
});

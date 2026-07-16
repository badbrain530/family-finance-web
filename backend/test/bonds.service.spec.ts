import { Test, TestingModule } from '@nestjs/testing';
import { BondsService } from '../src/modules/bonds/bonds.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FamiliesService } from '../src/modules/families/families.service';
import { LedgersService } from '../src/modules/ledgers/ledgers.service';
import { TransactionsService } from '../src/modules/transactions/transactions.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';

/**
 * 债券服务单元测试（仅 HELD 持有方，bullet 固定票息）
 * 覆盖：
 *  - computeBondSchedule 算法：periods / 每期票息 = 面值×年利率/每年期数；末期 principalReturn=面值、remaining=0
 *  - createBond 落库：bond.create + bondSchedule.createMany，末期 remainingPrincipal=0
 *  - generatePayments 生成票息（末期额外生成本金返还）与幂等（已 paid 不重复生成）
 * 不连真实库：PrismaService 与依赖服务全部 mock。
 */
describe('BondsService', () => {
  let service: BondsService;
  let prisma: any;
  let families: any;
  let ledgers: any;
  let txService: any;
  let events: any;

  beforeEach(async () => {
    prisma = {
      bond: {
        create: jest.fn().mockResolvedValue({ id: 'bond-1' }),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      bondSchedule: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn(),
      },
    };
    families = { validateFamilyMember: jest.fn().mockResolvedValue(true) };
    ledgers = { getLedger: jest.fn().mockResolvedValue({ id: 'l1', familyId: 'f1' }) };
    txService = { createTransaction: jest.fn().mockResolvedValue({ id: 'gen-tx' }) };
    events = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BondsService,
        { provide: PrismaService, useValue: prisma },
        { provide: FamiliesService, useValue: families },
        { provide: LedgersService, useValue: ledgers },
        { provide: TransactionsService, useValue: txService },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = module.get(BondsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('computeBondSchedule 算法', () => {
    it('MONTHLY：期数=termMonths，末期 principalReturn=面值、remaining=0', () => {
      const rows = (service as any).computeBondSchedule({
        faceValue: 10000,
        annualRate: 6,
        termMonths: 3,
        couponFrequency: 'MONTHLY',
        startDate: new Date('2024-01-01'),
      });
      expect(rows).toHaveLength(3);
      // 每期票息 = 10000 * 6% / 12 = 50
      expect(rows[0].coupon).toBe(50);
      expect(rows[1].coupon).toBe(50);
      expect(rows[2].coupon).toBe(50);
      // 仅末期返还本金
      expect(rows[0].principalReturn).toBe(0);
      expect(rows[0].remainingPrincipal).toBe(10000);
      expect(rows[2].principalReturn).toBe(10000);
      expect(rows[2].remainingPrincipal).toBe(0);
    });

    it('QUARTERLY：每年 4 期，末期 remaining=0', () => {
      const rows = (service as any).computeBondSchedule({
        faceValue: 20000,
        annualRate: 4,
        termMonths: 12,
        couponFrequency: 'QUARTERLY',
        startDate: new Date('2024-01-01'),
      });
      expect(rows).toHaveLength(4); // 12 / 3
      expect(rows[0].coupon).toBe(200); // 20000 * 4% / 4
      expect(rows[3].principalReturn).toBe(20000);
      expect(rows[3].remainingPrincipal).toBe(0);
    });

    it('ANNUAL：每年 1 期，票息=面值×年利率', () => {
      const rows = (service as any).computeBondSchedule({
        faceValue: 5000,
        annualRate: 5,
        termMonths: 24,
        couponFrequency: 'ANNUAL',
        startDate: new Date('2024-01-01'),
      });
      expect(rows).toHaveLength(2); // 24 / 12
      expect(rows[0].coupon).toBe(250); // 5000 * 5%
      expect(rows[1].principalReturn).toBe(5000);
    });
  });

  describe('createBond 落库', () => {
    it('生成 BondSchedule，末期 remainingPrincipal=0，且票息总和精确', async () => {
      prisma.bond.findUnique.mockResolvedValue({
        id: 'bond-1',
        familyId: 'f1',
        schedules: [],
      });

      await service.createBond('u1', {
        ledgerId: 'l1',
        name: '国债',
        faceValue: 10000,
        annualRate: 6,
        termMonths: 3,
        couponFrequency: 'MONTHLY',
        startDate: '2024-01-01',
      } as any);

      expect(prisma.bond.create).toHaveBeenCalledTimes(1);
      expect(prisma.bondSchedule.createMany).toHaveBeenCalledTimes(1);
      const rows = prisma.bondSchedule.createMany.mock.calls[0][0].data;
      expect(rows).toHaveLength(3);
      const couponSum = Math.round(rows.reduce((s: number, r: any) => s + r.coupon, 0) * 100) / 100;
      expect(couponSum).toBe(150); // 50 * 3
      expect(rows[rows.length - 1].remainingPrincipal).toBe(0);
    });
  });

  describe('generatePayments 生成票息 + 幂等', () => {
    const bond = {
      id: 'bond-1',
      ledgerId: 'l1',
      accountId: null,
      name: '国债',
      familyId: 'f1',
      schedules: [{ seq: 1 }, { seq: 2 }],
    };
    const pendingRows = [
      { id: 's1', seq: 1, coupon: 50, principalReturn: 0, dueDate: new Date('2024-02-01'), status: 'pending' },
      { id: 's2', seq: 2, coupon: 50, principalReturn: 10000, dueDate: new Date('2024-03-01'), status: 'pending' },
    ];

    it('正常：为 2 期 pending 生成票息，末期额外生成本金返还 INCOME', async () => {
      prisma.bond.findUnique.mockResolvedValue(bond);
      prisma.bondSchedule.findMany.mockResolvedValue(pendingRows);

      const res: any = await service.generatePayments('bond-1', 'u1', { upto: '2024-12-31' } as any);

      expect(res.generated).toBe(2);
      // 2 期票息 + 1 末期本金返还 = 3 笔 income 交易
      expect(txService.createTransaction).toHaveBeenCalledTimes(3);
      // 每笔都是 income
      txService.createTransaction.mock.calls.forEach((c: any[]) => {
        expect(c[1].type).toBe('income');
      });
      // bondSchedule.update 被调用 2 次（每期一次，写回 generatedTxId/status）
      expect(prisma.bondSchedule.update).toHaveBeenCalledTimes(2);
    });

    it('幂等：已 paid 的计划不再重复生成', async () => {
      prisma.bond.findUnique.mockResolvedValue(bond);
      prisma.bondSchedule.findMany.mockResolvedValue([]); // 无 pending

      const res: any = await service.generatePayments('bond-1', 'u1', { upto: '2024-12-31' } as any);

      expect(res.generated).toBe(0);
      expect(txService.createTransaction).not.toHaveBeenCalled();
    });
  });
});

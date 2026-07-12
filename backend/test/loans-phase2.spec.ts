import { Test, TestingModule } from '@nestjs/testing';
import { LoansService } from '../src/modules/loans/loans.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FamiliesService } from '../src/modules/families/families.service';
import { LedgersService } from '../src/modules/ledgers/ledgers.service';
import { TransactionsService } from '../src/modules/transactions/transactions.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * 按揭算法 / LoanSchedule 末期校正测试
 * 直接调用 private computeSchedule（运行时可访问）验证：
 *  - sum(principalPart) 精确等于贷款本金（末期抹平剩余本金）
 *  - 末期 remainingPrincipal === 0（无漂移）
 *  - 每期 payment ≈ principalPart + interestPart（小幅四舍五入容差内）
 * 另用 createLoan 验证计划落库时金额总和精确。
 * 不连真实库。
 */
describe('LoansService - 按揭末期校正', () => {
  let service: LoansService;
  let prisma: any;
  let families: any;
  let ledgers: any;
  let txService: any;
  let events: any;

  beforeEach(async () => {
    prisma = {
      loan: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      loanSchedule: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    families = { validateFamilyMember: jest.fn().mockResolvedValue(true) };
    ledgers = { getLedger: jest.fn().mockResolvedValue({ id: 'l1', familyId: 'f1' }) };
    txService = { createTransaction: jest.fn().mockResolvedValue({ id: 'gen-tx' }) };
    events = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansService,
        { provide: PrismaService, useValue: prisma },
        { provide: FamiliesService, useValue: families },
        { provide: LedgersService, useValue: ledgers },
        { provide: TransactionsService, useValue: txService },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = module.get(LoansService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const sumPP = (rows: any[]) =>
    Math.round(rows.reduce((s, r) => s + r.principalPart, 0) * 100) / 100;
  const sumPay = (rows: any[]) =>
    Math.round(rows.reduce((s, r) => s + r.payment, 0) * 100) / 100;
  const sumInterest = (rows: any[]) =>
    Math.round(rows.reduce((s, r) => s + r.interestPart, 0) * 100) / 100;

  describe('computeSchedule 算法', () => {
    it('EQUAL_INSTALLMENT：sum(principalPart) === 本金，末期 remainingPrincipal=0', () => {
      const rows = (service as any).computeSchedule({
        principal: 360000,
        annualRate: 4.9,
        termMonths: 360,
        method: 'EQUAL_INSTALLMENT',
        startDate: new Date('2024-01-01'),
      });
      expect(rows).toHaveLength(360);
      expect(sumPP(rows)).toBe(360000);
      expect(rows[rows.length - 1].remainingPrincipal).toBe(0);
      expect(sumPay(rows)).toBeGreaterThan(360000); // 含利息
    });

    it('EQUAL_PRINCIPAL：sum(principalPart) === 本金，末期 remainingPrincipal=0', () => {
      const rows = (service as any).computeSchedule({
        principal: 360000,
        annualRate: 4.9,
        termMonths: 360,
        method: 'EQUAL_PRINCIPAL',
        startDate: new Date('2024-01-01'),
      });
      expect(rows).toHaveLength(360);
      expect(sumPP(rows)).toBe(360000);
      expect(rows[rows.length - 1].remainingPrincipal).toBe(0);
    });

    it('零利率边界：等额本息末期校正使总额精确，无差1-2分', () => {
      const rows = (service as any).computeSchedule({
        principal: 1000,
        annualRate: 0,
        termMonths: 3,
        method: 'EQUAL_INSTALLMENT',
        startDate: new Date('2024-01-01'),
      });
      expect(rows.map((r: any) => r.principalPart)).toEqual([333.33, 333.33, 333.34]);
      expect(sumPP(rows)).toBe(1000);
      expect(rows[rows.length - 1].remainingPrincipal).toBe(0);
    });

    it('无漂移：payment 总额 ≈ 本金 + 利息总额（四舍五入容差 ≤ 5 分 * 期数已在单期 1 分内）', () => {
      const rows = (service as any).computeSchedule({
        principal: 200000,
        annualRate: 5.6,
        termMonths: 240,
        method: 'EQUAL_INSTALLMENT',
        startDate: new Date('2024-01-01'),
      });
      // 每期 payment 与 principalPart+interestPart 至多相差 1 分（double-rounding 上限）
      for (const r of rows) {
        expect(Math.abs(r.payment - (r.principalPart + r.interestPart))).toBeLessThanOrEqual(0.01);
      }
      // 总额层面：本金精确 + 利息，整体漂移在 5 元内（240 期累计四舍五入）
      expect(Math.abs(sumPay(rows) - (sumPP(rows) + sumInterest(rows)))).toBeLessThanOrEqual(5);
      expect(sumPP(rows)).toBe(200000);
      expect(rows[rows.length - 1].remainingPrincipal).toBe(0);
    });
  });

  describe('createLoan 落库', () => {
    it('生成的 LoanSchedule 本金合计精确等于贷款本金', async () => {
      prisma.loan.create.mockResolvedValue({ id: 'loan-1' });
      prisma.loan.findUnique.mockResolvedValue({ id: 'loan-1', familyId: 'f1', schedules: [] });

      await service.createLoan('u1', {
        ledgerId: 'l1',
        name: '房贷',
        principal: 120000,
        annualRate: 4.2,
        termMonths: 120,
        method: 'EQUAL_INSTALLMENT',
        startDate: '2024-01-01',
      } as any);

      expect(prisma.loanSchedule.createMany).toHaveBeenCalledTimes(1);
      const createManyArg = prisma.loanSchedule.createMany.mock.calls[0][0];
      const rows = createManyArg.data;
      expect(rows).toHaveLength(120);
      const totalPrincipal = Math.round(
        rows.reduce((s: number, r: any) => s + r.principalPart, 0) * 100,
      ) / 100;
      expect(totalPrincipal).toBe(120000);
      expect(rows[rows.length - 1].remainingPrincipal).toBe(0);
    });
  });
});

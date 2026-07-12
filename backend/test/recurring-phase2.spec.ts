import { Test, TestingModule } from '@nestjs/testing';
import { RecurringService } from '../src/modules/recurring/recurring.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FamiliesService } from '../src/modules/families/families.service';
import { LedgersService } from '../src/modules/ledgers/ledgers.service';
import { TransactionsService } from '../src/modules/transactions/transactions.service';

/**
 * 周期记账 nextRunAt 游标幂等测试
 * 核心：同一规则在一次 generate 调用内，对 nextRunAt<=before 的到期项只生成一次，
 * 生成后将游标推进到首个超界日（mock 的 prisma.recurringRule.update 收到推进后的 nextRunAt），
 * 再次以相同 before 调用不再重复生成。
 * 不连真实库：transactionsService.createTransaction 与 prisma 均 mock。
 */
describe('RecurringService - nextRunAt 幂等生成', () => {
  let service: RecurringService;
  let prisma: any;
  let families: any;
  let ledgers: any;
  let txService: any;

  beforeEach(async () => {
    prisma = {
      recurringRule: {
        findMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    families = { validateFamilyMember: jest.fn().mockResolvedValue(true) };
    ledgers = { getLedger: jest.fn() };
    txService = { createTransaction: jest.fn().mockResolvedValue({ id: 'gen-tx' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringService,
        { provide: PrismaService, useValue: prisma },
        { provide: FamiliesService, useValue: families },
        { provide: LedgersService, useValue: ledgers },
        { provide: TransactionsService, useValue: txService },
      ],
    }).compile();
    service = module.get(RecurringService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const makeRule = (over: any = {}) => ({
    id: 'r1',
    ledgerId: 'l1',
    categoryId: null,
    accountId: null,
    type: 'expense',
    amount: 10,
    merchant: null,
    note: null,
    frequency: 'DAILY',
    interval: 1,
    nextRunAt: new Date('2024-01-01T00:00:00Z'),
    endDate: null,
    ...over,
  });

  it('DAILY 规则在 [nextRunAt, before] 内每期生成一次，游标推进到首个超界日', async () => {
    const rules = [makeRule()];
    prisma.recurringRule.findMany.mockResolvedValue(rules);
    prisma.recurringRule.update.mockImplementation((args: any) => {
      const r = rules.find((x) => x.id === args.where.id);
      if (r) r.nextRunAt = args.data.nextRunAt;
      return Promise.resolve(r);
    });

    const res: any = await service.generate('u1', {
      familyId: 'f1',
      before: '2024-01-05T00:00:00Z',
    } as any);

    // 01-01 ~ 01-05 共 5 期，各生成一次
    expect(txService.createTransaction).toHaveBeenCalledTimes(5);
    expect(res.generated).toBe(5);
    expect(res.rules).toEqual(['r1']);

    // 游标推进到 2024-01-06（首个 > before 的日期）
    const updArg = prisma.recurringRule.update.mock.calls[0][0];
    expect(updArg.data.nextRunAt.toISOString()).toBe('2024-01-06T00:00:00.000Z');
  });

  it('幂等：游标推进后再以相同 before 生成，不产生重复交易', async () => {
    const rules = [makeRule()];
    prisma.recurringRule.findMany.mockImplementation(() => Promise.resolve(rules));
    prisma.recurringRule.update.mockImplementation((args: any) => {
      const r = rules.find((x) => x.id === args.where.id);
      if (r) r.nextRunAt = args.data.nextRunAt;
      return Promise.resolve(r);
    });

    const first: any = await service.generate('u1', {
      familyId: 'f1',
      before: '2024-01-05T00:00:00Z',
    } as any);
    expect(first.generated).toBe(5);

    // 第二次调用：规则 nextRunAt 已被推进到 01-06 > before，findMany 应返回空
    txService.createTransaction.mockClear();
    const second: any = await service.generate('u1', {
      familyId: 'f1',
      before: '2024-01-05T00:00:00Z',
    } as any);
    expect(second.generated).toBe(0);
    expect(txService.createTransaction).not.toHaveBeenCalled();
  });

  it('MONTHLY 规则按期推进：3 个月内生成 3 笔（含起始月）', async () => {
    const rules = [makeRule({ frequency: 'MONTHLY', interval: 1, nextRunAt: new Date('2024-01-15T00:00:00Z') })];
    prisma.recurringRule.findMany.mockResolvedValue(rules);
    prisma.recurringRule.update.mockImplementation((args: any) => {
      const r = rules.find((x) => x.id === args.where.id);
      if (r) r.nextRunAt = args.data.nextRunAt;
      return Promise.resolve(r);
    });

    const res: any = await service.generate('u1', {
      familyId: 'f1',
      before: '2024-03-31T00:00:00Z',
    } as any);

    expect(res.generated).toBe(3); // 01-15, 02-15, 03-15
    const updArg = prisma.recurringRule.update.mock.calls[0][0];
    expect(updArg.data.nextRunAt.toISOString()).toBe('2024-04-15T00:00:00.000Z');
  });

  it('endDate 之后停止生成（不越界）', async () => {
    const rules = [
      makeRule({ endDate: new Date('2024-01-03T00:00:00Z') }),
    ];
    prisma.recurringRule.findMany.mockResolvedValue(rules);
    prisma.recurringRule.update.mockImplementation((args: any) => {
      const r = rules.find((x) => x.id === args.where.id);
      if (r) r.nextRunAt = args.data.nextRunAt;
      return Promise.resolve(r);
    });

    const res: any = await service.generate('u1', {
      familyId: 'f1',
      before: '2024-02-01T00:00:00Z',
    } as any);

    expect(res.generated).toBe(3); // 01-01, 01-02, 01-03（01-04 已超 endDate）
  });
});

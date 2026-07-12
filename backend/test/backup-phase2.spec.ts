import { Test, TestingModule } from '@nestjs/testing';
import { BackupService } from '../src/modules/backup/backup.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FamiliesService } from '../src/modules/families/families.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * 备份恢复事务一致性测试
 * 核心：restore 在 $transaction 回调内，删除顺序必须「子表先于父表」：
 *   loan_schedules → loans → recurring_rules → transactions → budgets →
 *   wish_goals → accounts → categories → ledgers → monthly_reports
 * 断言各模型 deleteMany 的调用顺序符合上述顺序。
 * 另测 previewOnly=true：仅返回 counts，不调用 $transaction 写入。
 * 不连真实库：prisma.$transaction 以 (fn)=>fn(txMock) 捕获调用顺序。
 */
describe('BackupService - 恢复事务一致性', () => {
  let service: BackupService;
  let prisma: any;
  let families: any;
  let events: any;

  beforeEach(async () => {
    prisma = { $transaction: jest.fn() };
    families = { validateFamilyRole: jest.fn().mockResolvedValue(true) };
    events = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupService,
        { provide: PrismaService, useValue: prisma },
        { provide: FamiliesService, useValue: families },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = module.get(BackupService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const buildPayload = () => ({
    version: '1.0',
    exportedAt: '2024-01-01T00:00:00Z',
    familyId: 'f1',
    data: {
      ledgers: [{ id: 'l1' }],
      categories: [{ id: 'c1' }],
      accounts: [{ id: 'a1' }],
      transactions: [{ id: 't1' }],
      budgets: [{ id: 'b1' }],
      wish_goals: [{ id: 'w1' }],
      monthly_reports: [{ id: 'm1' }],
      recurring_rules: [{ id: 'r1' }],
      loans: [{ id: 'loan1', schedules: [{ id: 's1' }] }],
    },
  });

  const EXPECTED_ORDER = [
    'loanSchedule',
    'loan',
    'recurringRule',
    'transaction',
    'budget',
    'wishGoal',
    'account',
    'category',
    'ledger',
    'monthlyReport',
  ];

  it('restore：子表先于父表删除，顺序严格正确', async () => {
    const callOrder: string[] = [];
    const mkDelete = (name: string) =>
      jest.fn(() => {
        callOrder.push(name);
        return Promise.resolve({ count: 0 });
      });
    const txMock: any = {
      loanSchedule: { deleteMany: mkDelete('loanSchedule'), createMany: jest.fn() },
      loan: { deleteMany: mkDelete('loan'), createMany: jest.fn() },
      recurringRule: { deleteMany: mkDelete('recurringRule'), createMany: jest.fn() },
      transaction: { deleteMany: mkDelete('transaction'), createMany: jest.fn() },
      budget: { deleteMany: mkDelete('budget'), createMany: jest.fn() },
      wishGoal: { deleteMany: mkDelete('wishGoal'), createMany: jest.fn() },
      account: { deleteMany: mkDelete('account'), createMany: jest.fn() },
      category: { deleteMany: mkDelete('category'), createMany: jest.fn() },
      ledger: { deleteMany: mkDelete('ledger'), createMany: jest.fn() },
      monthlyReport: { deleteMany: mkDelete('monthlyReport'), createMany: jest.fn() },
    };
    // 捕获回调内的调用顺序
    prisma.$transaction = (fn: any) => fn(txMock);

    const dto: any = { familyId: 'f1', payload: buildPayload(), mode: 'overwrite' };
    const res: any = await service.restore('u1', dto);

    expect(callOrder).toEqual(EXPECTED_ORDER);
    expect(res.restored).toBeDefined();
    // 每类均按 payload 写入对应条数（含 loan→loanSchedule 嵌套展开）
    expect(txMock.loanSchedule.createMany).toHaveBeenCalledTimes(1);
    expect(txMock.loan.createMany).toHaveBeenCalledTimes(1);
    expect(txMock.recurringRule.createMany).toHaveBeenCalledTimes(1);
    expect(txMock.transaction.createMany).toHaveBeenCalledTimes(1);
    expect(txMock.budget.createMany).toHaveBeenCalledTimes(1);
    expect(txMock.wishGoal.createMany).toHaveBeenCalledTimes(1);
    expect(txMock.account.createMany).toHaveBeenCalledTimes(1);
    expect(txMock.category.createMany).toHaveBeenCalledTimes(1);
    expect(txMock.ledger.createMany).toHaveBeenCalledTimes(1);
    expect(txMock.monthlyReport.createMany).toHaveBeenCalledTimes(1);
  });

  it('previewOnly=true：仅返回 counts，不调用 $transaction 写入', async () => {
    const dto: any = {
      familyId: 'f1',
      payload: buildPayload(),
      mode: 'overwrite',
      previewOnly: true,
    };

    const res: any = await service.restore('u1', dto);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
    expect(res.counts).toEqual({
      ledgers: 1,
      categories: 1,
      accounts: 1,
      transactions: 1,
      budgets: 1,
      wish_goals: 1,
      monthly_reports: 1,
      recurring_rules: 1,
      loans: 1,
    });
  });

  it('restore 写入后回写 restored 条数统计', async () => {
    const callOrder: string[] = [];
    const mkDelete = (name: string) =>
      jest.fn(() => {
        callOrder.push(name);
        return Promise.resolve({ count: 0 });
      });
    const txMock: any = {
      loanSchedule: { deleteMany: mkDelete('loanSchedule'), createMany: jest.fn() },
      loan: { deleteMany: mkDelete('loan'), createMany: jest.fn() },
      recurringRule: { deleteMany: mkDelete('recurringRule'), createMany: jest.fn() },
      transaction: { deleteMany: mkDelete('transaction'), createMany: jest.fn() },
      budget: { deleteMany: mkDelete('budget'), createMany: jest.fn() },
      wishGoal: { deleteMany: mkDelete('wishGoal'), createMany: jest.fn() },
      account: { deleteMany: mkDelete('account'), createMany: jest.fn() },
      category: { deleteMany: mkDelete('category'), createMany: jest.fn() },
      ledger: { deleteMany: mkDelete('ledger'), createMany: jest.fn() },
      monthlyReport: { deleteMany: mkDelete('monthlyReport'), createMany: jest.fn() },
    };
    prisma.$transaction = (fn: any) => fn(txMock);

    const dto: any = { familyId: 'f1', payload: buildPayload(), mode: 'overwrite' };
    const res: any = await service.restore('u1', dto);

    expect(res.restored).toEqual({
      loan_schedules: 1,
      loans: 1,
      recurring_rules: 1,
      transactions: 1,
      budgets: 1,
      wish_goals: 1,
      accounts: 1,
      categories: 1,
      ledgers: 1,
      monthly_reports: 1,
    });
    expect(events.emit).toHaveBeenCalledWith('backup.restored', expect.any(Object));
  });
});

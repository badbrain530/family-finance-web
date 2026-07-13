import { Test, TestingModule } from '@nestjs/testing';
import { LedgersService } from '../src/modules/ledgers/ledgers.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FamiliesService } from '../src/modules/families/families.service';
import { AuthenticatedUser } from '../src/modules/auth/decorators/current-user.decorator';
import { BadRequestException } from '@nestjs/common';

/**
 * LedgersService.deleteLedger 单元测试（应用层手动级联删除）
 *
 * 不连接真实数据库：用 jest.fn() mock PrismaService 与 FamiliesService。
 * 重点验证：
 *   1) 在单个 $transaction 中按依赖顺序级联删除子数据（transaction/account/recurringRule/loan/importRecord），
 *      最后删除账本本身；
 *   2) 即便账本下已有交易（_count.transactions > 0）也不再拒绝，而是级联删除；
 *   3) 权限校验失败（SHARED 非 OWNER/ADMIN）时直接抛错且不进入事务（保证原子回滚）。
 */
describe('LedgersService - deleteLedger 级联删除', () => {
  let service: LedgersService;
  let prisma: Record<string, any>;
  let familiesService: Record<string, any>;
  let tx: Record<string, any>;

  const user: AuthenticatedUser = { userId: 'u1', nickname: 'tester' };

  const sharedLedger = {
    id: 'ledger-1',
    familyId: 'fam-1',
    type: 'SHARED',
    ownerId: null,
    _count: { transactions: 5 },
  };

  beforeEach(async () => {
    // 事务回调内使用的 Prisma 客户端（交互式事务）
    tx = {
      transaction: {
        findMany: jest.fn().mockResolvedValue([{ id: 't1' }, { id: 't2' }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      classificationFeedback: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      account: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      recurringRule: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      loan: {
        findMany: jest.fn().mockResolvedValue([{ id: 'loan-1' }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      loanSchedule: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      importRecord: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      ledger: { delete: jest.fn().mockResolvedValue({ id: 'ledger-1' }) },
    };

    prisma = {
      ledger: {
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      transaction: { deleteMany: jest.fn() },
      account: { deleteMany: jest.fn() },
      recurringRule: { deleteMany: jest.fn() },
      loan: { deleteMany: jest.fn() },
      importRecord: { deleteMany: jest.fn() },
      classificationFeedback: { deleteMany: jest.fn() },
      loanSchedule: { deleteMany: jest.fn() },
      // 交互式事务：执行回调并返回其结果，从而可以在测试中断言回调内的调用
      $transaction: jest.fn((fn: any) => fn(tx)),
    };

    familiesService = {
      validateFamilyMember: jest.fn().mockResolvedValue(true),
      validateFamilyRole: jest.fn().mockResolvedValue(true),
      getUserFamilies: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgersService,
        { provide: PrismaService, useValue: prisma },
        { provide: FamiliesService, useValue: familiesService },
      ],
    }).compile();

    service = module.get<LedgersService>(LedgersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('级联删除：在 $transaction 中按依赖顺序删除子/孙数据并最后删账本本身', async () => {
    prisma.ledger.findUnique.mockResolvedValue(sharedLedger);
    familiesService.validateFamilyRole.mockResolvedValue(true);

    const result = await service.deleteLedger('ledger-1', user.userId);

    // 返回结构保持一致
    expect(result).toEqual({ success: true });
    // 整体包裹在单个事务中
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    // 1) 交易：先按 id 列表删 classificationFeedback，再删交易本身
    expect(tx.transaction.findMany).toHaveBeenCalledWith({
      where: { ledgerId: 'ledger-1' },
      select: { id: true },
    });
    expect(tx.classificationFeedback.deleteMany).toHaveBeenCalledWith({
      where: { transactionId: { in: ['t1', 't2'] } },
    });
    expect(tx.transaction.deleteMany).toHaveBeenCalledWith({ where: { ledgerId: 'ledger-1' } });

    // 2) 账户 / 周期规则
    expect(tx.account.deleteMany).toHaveBeenCalledWith({ where: { ledgerId: 'ledger-1' } });
    expect(tx.recurringRule.deleteMany).toHaveBeenCalledWith({ where: { ledgerId: 'ledger-1' } });

    // 3) 贷款：先按 id 列表删还款计划 LoanSchedule，再删贷款本身
    expect(tx.loan.findMany).toHaveBeenCalledWith({
      where: { ledgerId: 'ledger-1' },
      select: { id: true },
    });
    expect(tx.loanSchedule.deleteMany).toHaveBeenCalledWith({
      where: { loanId: { in: ['loan-1'] } },
    });
    expect(tx.loan.deleteMany).toHaveBeenCalledWith({ where: { ledgerId: 'ledger-1' } });

    // 4) 导入记录
    expect(tx.importRecord.deleteMany).toHaveBeenCalledWith({ where: { ledgerId: 'ledger-1' } });

    // 5) 最后删除账本本身
    expect(tx.ledger.delete).toHaveBeenCalledWith({ where: { id: 'ledger-1' } });
    // 不应在事务外直接调用顶层 ledger.delete
    expect(prisma.ledger.delete).not.toHaveBeenCalled();

    // 6) 顺序断言（回归防护）：孙子表必须先于其父表删除，否则真实库
    //    FK(RESTRICT) 冲突会导致整事务回滚、删除失败。
    expect(tx.classificationFeedback.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.transaction.deleteMany.mock.invocationCallOrder[0],
    );
    expect(tx.loanSchedule.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.loan.deleteMany.mock.invocationCallOrder[0],
    );
  });

  it('账本下已有交易（_count.transactions > 0）时不再拒绝，而是级联删除', async () => {
    prisma.ledger.findUnique.mockResolvedValue(sharedLedger); // _count.transactions = 5
    familiesService.validateFamilyRole.mockResolvedValue(true);

    const result = await service.deleteLedger('ledger-1', user.userId);

    expect(result).toEqual({ success: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.transaction.deleteMany).toHaveBeenCalledWith({ where: { ledgerId: 'ledger-1' } });
  });

  it('贷款含还款计划（LoanSchedule）时：先删 schedule 再删 loan，避免 FK 回滚', async () => {
    // 该账本下有一笔带还款计划的贷款
    tx.loan.findMany.mockResolvedValue([{ id: 'loan-9' }, { id: 'loan-10' }]);
    tx.loanSchedule.deleteMany.mockResolvedValue({ count: 3 });
    prisma.ledger.findUnique.mockResolvedValue(sharedLedger);
    familiesService.validateFamilyRole.mockResolvedValue(true);

    const result = await service.deleteLedger('ledger-1', user.userId);

    expect(result).toEqual({ success: true });
    // 必须先用查到的 loanId 列表删掉还款计划，才能安全删 loan
    expect(tx.loanSchedule.deleteMany).toHaveBeenCalledWith({
      where: { loanId: { in: ['loan-9', 'loan-10'] } },
    });
    expect(tx.loan.deleteMany).toHaveBeenCalledWith({ where: { ledgerId: 'ledger-1' } });
    // 顺序：schedule 删除必须在 loan 删除之前
    const scheduleCallOrder = tx.loanSchedule.deleteMany.mock.invocationCallOrder[0];
    const loanCallOrder = tx.loan.deleteMany.mock.invocationCallOrder[0];
    expect(scheduleCallOrder).toBeLessThan(loanCallOrder);
  });

  it('SHARED 账本非 OWNER/ADMIN：权限校验失败直接抛错且不进入事务', async () => {
    prisma.ledger.findUnique.mockResolvedValue(sharedLedger);
    familiesService.validateFamilyRole.mockRejectedValue(
      new BadRequestException('权限等级不足，无法删除该账本'),
    );

    await expect(service.deleteLedger('ledger-1', user.userId)).rejects.toThrow(BadRequestException);
    // 权限失败应早于事务，避免误删
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('PERSONAL 账本非 owner：权限校验失败直接抛错', async () => {
    prisma.ledger.findUnique.mockResolvedValue({
      id: 'ledger-2',
      familyId: 'fam-1',
      type: 'PERSONAL',
      ownerId: 'other-user',
      _count: { transactions: 0 },
    });

    await expect(service.deleteLedger('ledger-2', user.userId)).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { AdvancesService } from '../src/modules/advances/advances.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FamiliesService } from '../src/modules/families/families.service';
import { LedgersService } from '../src/modules/ledgers/ledgers.service';
import { TransactionsService } from '../src/modules/transactions/transactions.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException } from '@nestjs/common';

/**
 * 垫付服务单元测试
 * 覆盖：
 *  - registerAdvance：先建源 EXPENSE 交易（含债务人名），再建 AdvanceReceivable（PENDING）
 *  - collect：部分收回 → PARTIAL；全额/超额 → 末期校正 RECOVERED + remaining 归零
 *  - collect：已 RECOVERED/CANCELLED 拒绝再收回
 * 不连真实库：PrismaService 与依赖服务全部 mock。
 */
describe('AdvancesService', () => {
  let service: AdvancesService;
  let prisma: any;
  let families: any;
  let ledgers: any;
  let txService: any;
  let events: any;

  const ADVANCE = {
    id: 'a1',
    familyId: 'f1',
    ledgerId: 'l1',
    accountId: 'acc1',
    payerId: 'u1',
    debtorName: '张三',
    debtorType: 'PERSON',
    sourceTxId: 'src-tx',
    amount: 100,
    repaidAmount: 0,
    remainingAmount: 100,
    dueDate: null,
    status: 'PENDING',
    note: null,
    sourceTx: { id: 'src-tx' },
  };

  beforeEach(async () => {
    prisma = {
      advanceReceivable: {
        create: jest.fn().mockResolvedValue({ id: 'a1' }),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn((args: any) => Promise.resolve({ id: 'a1', ...args.data })),
        delete: jest.fn(),
      },
    };
    families = { validateFamilyMember: jest.fn().mockResolvedValue(true) };
    ledgers = { getLedger: jest.fn().mockResolvedValue({ id: 'l1', familyId: 'f1' }) };
    txService = { createTransaction: jest.fn().mockResolvedValue({ id: 'gen-tx' }) };
    events = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdvancesService,
        { provide: PrismaService, useValue: prisma },
        { provide: FamiliesService, useValue: families },
        { provide: LedgersService, useValue: ledgers },
        { provide: TransactionsService, useValue: txService },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = module.get(AdvancesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerAdvance 登记垫付', () => {
    it('先建源 EXPENSE 交易（含债务人名），再建 AdvanceReceivable（PENDING）', async () => {
      prisma.advanceReceivable.findUnique.mockResolvedValue(ADVANCE);

      const res: any = await service.registerAdvance('u1', {
        ledgerId: 'l1',
        accountId: 'acc1',
        payerId: 'u1',
        debtorName: '张三',
        debtorType: 'PERSON',
        amount: 100,
        note: '午餐代付',
      } as any);

      // 源交易：expense、金额=垫付额、note 含债务人名
      const txCall = txService.createTransaction.mock.calls[0];
      expect(txCall[0]).toBe('u1');
      expect(txCall[1].type).toBe('expense');
      expect(txCall[1].amount).toBe(100);
      expect(txCall[1].note).toContain('张三');

      // 应收登记：PENDING、remaining=full
      expect(prisma.advanceReceivable.create).toHaveBeenCalledTimes(1);
      const createData = prisma.advanceReceivable.create.mock.calls[0][0].data;
      expect(createData.status).toBe('PENDING');
      expect(createData.remainingAmount).toBe(100);
      expect(createData.sourceTxId).toBe('gen-tx');

      // 返回含 sourceTx
      expect(res.sourceTx).toBeDefined();
    });
  });

  describe('collect 收回垫付', () => {
    it('部分收回：PARTIAL + 余额递减，生成 INCOME（advanceOfId）', async () => {
      prisma.advanceReceivable.findUnique.mockResolvedValue({ ...ADVANCE });

      const res: any = await service.collect('a1', 'u1', { amount: 40, date: '2024-02-01' } as any);

      expect(res.repaidAmount).toBe(40);
      expect(res.remainingAmount).toBe(60);
      expect(res.status).toBe('PARTIAL');

      const txCall = txService.createTransaction.mock.calls[0];
      expect(txCall[1].type).toBe('income');
      expect(txCall[1].amount).toBe(40);
      expect(txCall[1].advanceOfId).toBe('a1');

      expect(prisma.advanceReceivable.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            repaidAmount: 40,
            remainingAmount: 60,
            status: 'PARTIAL',
          }),
        }),
      );
    });

    it('全额收回：末期校正 RECOVERED + remaining 归零', async () => {
      prisma.advanceReceivable.findUnique.mockResolvedValue({ ...ADVANCE });

      const res: any = await service.collect('a1', 'u1', { amount: 100, date: '2024-03-01' } as any);

      expect(res.status).toBe('RECOVERED');
      expect(res.remainingAmount).toBe(0);
      expect(txService.createTransaction.mock.calls[0][1].amount).toBe(100);
      expect(prisma.advanceReceivable.update.mock.calls[0][0].data.remainingAmount).toBe(0);
      expect(prisma.advanceReceivable.update.mock.calls[0][0].data.status).toBe('RECOVERED');
    });

    it('超额收回被钳制为剩余应收（不超 original 额）', async () => {
      prisma.advanceReceivable.findUnique.mockResolvedValue({ ...ADVANCE });

      const res: any = await service.collect('a1', 'u1', { amount: 150, date: '2024-03-01' } as any);

      // collected 被钳制为 100 → RECOVERED、remaining 0
      expect(res.repaidAmount).toBe(100);
      expect(res.remainingAmount).toBe(0);
      expect(res.status).toBe('RECOVERED');
      expect(txService.createTransaction.mock.calls[0][1].amount).toBe(100);
    });

    it('已 RECOVERED 拒绝再收回（BadRequestException）', async () => {
      prisma.advanceReceivable.findUnique.mockResolvedValue({
        ...ADVANCE,
        status: 'RECOVERED',
        remainingAmount: 0,
        repaidAmount: 100,
      });

      await expect(
        service.collect('a1', 'u1', { amount: 10, date: '2024-04-01' } as any),
      ).rejects.toThrow(BadRequestException);
      expect(txService.createTransaction).not.toHaveBeenCalled();
    });
  });
});

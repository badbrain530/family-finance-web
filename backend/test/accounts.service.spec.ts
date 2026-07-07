import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from '../src/modules/accounts/accounts.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FamiliesService } from '../src/modules/families/families.service';
import { AuthenticatedUser } from '../src/modules/auth/decorators/current-user.decorator';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

/**
 * AccountsService 纯逻辑单元测试
 * 不连接真实数据库：用 jest.fn() mock PrismaService 与 FamiliesService。
 * 覆盖：信用卡可用额度计算、停用翻转、family/ledger 隔离校验异常分支、Decimal→number 序列化。
 */
describe('AccountsService', () => {
  let service: AccountsService;
  let prisma: Record<string, any>;
  let familiesService: Record<string, any>;

  const user: AuthenticatedUser = { userId: 'u1', nickname: 'tester' };

  beforeEach(async () => {
    prisma = {
      account: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      ledger: {
        findUnique: jest.fn(),
      },
    };

    familiesService = {
      validateFamilyMember: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: prisma },
        { provide: FamiliesService, useValue: familiesService },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAccount - 信用卡可用额度计算', () => {
    it('CREDIT：availableCredit = creditLimit - balance', async () => {
      familiesService.validateFamilyMember.mockResolvedValue(true);
      prisma.account.create.mockImplementation((args: any) =>
        Promise.resolve(args.data),
      );

      const dto = {
        familyId: 'f1',
        type: 'CREDIT',
        name: '招行信用卡',
        balance: 3200,
        creditLimit: 20000,
      } as any;

      const result = await service.createAccount(user, dto);

      expect(result.availableCredit).toBe(16800);
      expect(prisma.account.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ availableCredit: 16800 }),
        }),
      );
    });

    it('非 CREDIT（DEBIT）：availableCredit 为 null', async () => {
      familiesService.validateFamilyMember.mockResolvedValue(true);
      prisma.account.create.mockImplementation((args: any) =>
        Promise.resolve(args.data),
      );

      const dto = {
        familyId: 'f1',
        type: 'DEBIT',
        name: '招行储蓄卡',
        balance: 12850,
      } as any;

      const result = await service.createAccount(user, dto);

      expect(result.availableCredit).toBeNull();
    });

    it('CREDIT 但未提供 creditLimit：availableCredit 为 null（不误算）', async () => {
      familiesService.validateFamilyMember.mockResolvedValue(true);
      prisma.account.create.mockImplementation((args: any) =>
        Promise.resolve(args.data),
      );

      const dto = {
        familyId: 'f1',
        type: 'CREDIT',
        name: '信用卡',
        balance: 1000,
      } as any;

      const result = await service.createAccount(user, dto);

      expect(result.availableCredit).toBeNull();
    });
  });

  describe('createAccount - ledger 隔离校验', () => {
    const baseDto = () => ({
      familyId: 'f1',
      type: 'DEBIT',
      name: '卡',
      balance: 0,
      ledgerId: 'ledger-x',
    });

    it('ledger 不存在：抛出 NotFoundException', async () => {
      familiesService.validateFamilyMember.mockResolvedValue(true);
      prisma.ledger.findUnique.mockResolvedValue(null);

      await expect(
        service.createAccount(user, baseDto() as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('ledger 不属于该家庭：抛出 BadRequestException', async () => {
      familiesService.validateFamilyMember.mockResolvedValue(true);
      prisma.ledger.findUnique.mockResolvedValue({ id: 'ledger-x', familyId: 'other' });

      await expect(
        service.createAccount(user, baseDto() as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('ledger 属于该家庭：通过校验', async () => {
      familiesService.validateFamilyMember.mockResolvedValue(true);
      prisma.ledger.findUnique.mockResolvedValue({ id: 'ledger-x', familyId: 'f1' });
      prisma.account.create.mockImplementation((args: any) => Promise.resolve(args.data));

      const result = await service.createAccount(user, baseDto() as any);
      expect(result.ledgerId).toBe('ledger-x');
    });
  });

  describe('createAccount - family 隔离校验', () => {
    it('非家庭成员：validateFamilyMember 抛 ForbiddenException，createAccount 透传', async () => {
      familiesService.validateFamilyMember.mockRejectedValue(
        new ForbiddenException('您不是该家庭的成员'),
      );

      await expect(
        service.createAccount(user, {
          familyId: 'fX',
          type: 'CASH',
          name: '现金',
          balance: 0,
        } as any),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deactivateAccount - 翻转 isActive', () => {
    it('启用(true)→停用(false)', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'a1',
        familyId: 'f1',
        isActive: true,
      });
      familiesService.validateFamilyMember.mockResolvedValue(true);
      prisma.account.update.mockImplementation((args: any) =>
        Promise.resolve({ ...args.data }),
      );

      const result = await service.deactivateAccount('a1', user);
      expect(result.isActive).toBe(false);
      expect(prisma.account.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });

    it('停用(false)→启用(true)', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'a1',
        familyId: 'f1',
        isActive: false,
      });
      familiesService.validateFamilyMember.mockResolvedValue(true);
      prisma.account.update.mockImplementation((args: any) =>
        Promise.resolve({ ...args.data }),
      );

      const result = await service.deactivateAccount('a1', user);
      expect(result.isActive).toBe(true);
    });

    it('账户不存在：抛出 NotFoundException', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(service.deactivateAccount('x', user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('非家庭成员：透传 ForbiddenException', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'a1',
        familyId: 'f1',
        isActive: true,
      });
      familiesService.validateFamilyMember.mockRejectedValue(
        new ForbiddenException('您不是该家庭的成员'),
      );

      await expect(service.deactivateAccount('a1', user)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updateAccount - 信用卡可用额度重算', () => {
    it('CREDIT 且提供了新 balance：availableCredit 用新值重算', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'a1',
        familyId: 'f1',
        type: 'CREDIT',
        creditLimit: 20000,
        balance: 3200,
      });
      familiesService.validateFamilyMember.mockResolvedValue(true);
      prisma.account.update.mockImplementation((args: any) =>
        Promise.resolve({ ...args.data }),
      );

      const result = await service.updateAccount('a1', user, { balance: 5000 } as any);
      expect(result.availableCredit).toBe(15000);
    });

    it('非 CREDIT：不重算 availableCredit（serializeAccount 将缺失值归一为 null）', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'a1',
        familyId: 'f1',
        type: 'DEBIT',
        creditLimit: null,
        balance: 100,
      });
      familiesService.validateFamilyMember.mockResolvedValue(true);
      // 非 CREDIT 时 service 不会往 data 写入 availableCredit，
      // serializeAccount 将缺失的 undefined 归一为 null（而非数值）
      prisma.account.update.mockImplementation((args: any) =>
        Promise.resolve({ ...args.data }),
      );

      const result = await service.updateAccount('a1', user, { balance: 200 } as any);
      expect(result.availableCredit).toBeNull();
    });
  });

  describe('getAccounts / getAccountById - family 隔离与查询', () => {
    it('getAccounts 非家庭成员透传 ForbiddenException', async () => {
      familiesService.validateFamilyMember.mockRejectedValue(
        new ForbiddenException('您不是该家庭的成员'),
      );

      await expect(service.getAccounts('fX', user)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('getAccountById 账户不存在抛 NotFoundException', async () => {
      prisma.account.findUnique.mockResolvedValue(null);

      await expect(service.getAccountById('x', user)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('getAccountById 非家庭成员透传 ForbiddenException', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'a1',
        familyId: 'f1',
        balance: '100',
      });
      familiesService.validateFamilyMember.mockRejectedValue(
        new ForbiddenException('您不是该家庭的成员'),
      );

      await expect(service.getAccountById('a1', user)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('serializeAccount - Decimal 字符串序列化为 number', () => {
    it('将 balance/creditLimit/availableCredit 的 Decimal 字符串转为 number', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'a1',
        familyId: 'f1',
        balance: '1234.50',
        creditLimit: '20000',
        availableCredit: '18765.50',
      });
      familiesService.validateFamilyMember.mockResolvedValue(true);

      const result = await service.getAccountById('a1', user);

      expect(result.balance).toBe(1234.5);
      expect(typeof result.balance).toBe('number');
      expect(typeof result.creditLimit).toBe('number');
      expect(typeof result.availableCredit).toBe('number');
    });

    it('null 金额字段序列化为 null（非 NaN）', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'a1',
        familyId: 'f1',
        balance: '0',
        creditLimit: null,
        availableCredit: null,
      });
      familiesService.validateFamilyMember.mockResolvedValue(true);

      const result = await service.getAccountById('a1', user);

      expect(result.creditLimit).toBeNull();
      expect(result.availableCredit).toBeNull();
    });
  });
});

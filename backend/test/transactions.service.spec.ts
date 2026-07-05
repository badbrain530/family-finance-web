import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from '../src/modules/transactions/transactions.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { LedgersService } from '../src/modules/ledgers/ledgers.service';
import { CategoriesService } from '../src/modules/categories/categories.service';
import { FamiliesService } from '../src/modules/families/families.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: Record<string, any>;
  let ledgersService: Record<string, any>;
  let categoriesService: Record<string, any>;
  let familiesService: Record<string, any>;
  let eventEmitter: Record<string, any>;

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
      category: {
        findUnique: jest.fn(),
      },
      classificationFeedback: {
        create: jest.fn(),
      },
    };

    ledgersService = {
      getLedger: jest.fn(),
    };

    categoriesService = {
      matchCategoryByKeyword: jest.fn(),
    };

    familiesService = {
      validateFamilyMember: jest.fn(),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LedgersService, useValue: ledgersService },
        { provide: CategoriesService, useValue: categoriesService },
        { provide: FamiliesService, useValue: familiesService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTransaction', () => {
    const userId = 'user-1';
    const dto = {
      ledgerId: 'ledger-1',
      type: 'expense' as const,
      amount: 50,
      date: '2024-06-15T10:00:00Z',
      merchant: 'Test Store',
      note: 'Test note',
    };

    const mockLedger = { id: 'ledger-1', familyId: 'family-1' };
    const mockTransaction = {
      id: 'txn-1',
      ledgerId: 'ledger-1',
      userId,
      categoryId: null,
      type: 'EXPENSE',
      amount: 50,
      date: new Date('2024-06-15T10:00:00Z'),
      merchant: 'Test Store',
      note: 'Test note',
      source: 'MANUAL',
      isLargeExpense: false,
      aiCorrected: false,
      tags: [],
      category: null,
      user: { id: 'user-1', nickname: 'TestUser', avatar: null },
    };

    it('should create a transaction successfully', async () => {
      ledgersService.getLedger.mockResolvedValue(mockLedger);
      prisma.transaction.create.mockResolvedValue(mockTransaction);

      const result = await service.createTransaction(userId, dto);

      expect(result.id).toBe('txn-1');
      expect(result.amount).toBe(50);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'transaction.created',
        expect.objectContaining({
          ledgerId: 'ledger-1',
          familyId: 'family-1',
          userId,
        }),
      );
    });

    it('should mark as large expense when amount >= 1000 and type is expense', async () => {
      ledgersService.getLedger.mockResolvedValue(mockLedger);
      prisma.transaction.create.mockResolvedValue({
        ...mockTransaction,
        amount: 1500,
        isLargeExpense: true,
      });

      await service.createTransaction(userId, { ...dto, amount: 1500 });

      // Verify create was called with isLargeExpense=true
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isLargeExpense: true,
          }),
        }),
      );
      // Large expense event should be emitted
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'transaction.large_expense',
        expect.any(Object),
      );
    });

    it('should not mark as large expense when type is income', async () => {
      ledgersService.getLedger.mockResolvedValue(mockLedger);
      prisma.transaction.create.mockResolvedValue({
        ...mockTransaction,
        type: 'INCOME',
        amount: 1500,
        isLargeExpense: false,
      });

      await service.createTransaction(userId, { ...dto, type: 'income', amount: 1500 });

      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isLargeExpense: false,
          }),
        }),
      );
    });

    it('should validate category belongs to the family', async () => {
      ledgersService.getLedger.mockResolvedValue(mockLedger);
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-1',
        familyId: 'other-family',
      });

      await expect(
        service.createTransaction(userId, { ...dto, categoryId: 'cat-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when category does not exist', async () => {
      ledgersService.getLedger.mockResolvedValue(mockLedger);
      prisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.createTransaction(userId, { ...dto, categoryId: 'nonexistent' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTransactions', () => {
    const userId = 'user-1';
    const mockTransactions = [
      { id: 'txn-1', amount: 50, type: 'EXPENSE' },
      { id: 'txn-2', amount: 100, type: 'INCOME' },
    ];

    it('should return paginated transactions', async () => {
      ledgersService.getLedger.mockResolvedValue({ id: 'ledger-1', familyId: 'family-1' });
      prisma.transaction.count.mockResolvedValue(2);
      prisma.transaction.findMany.mockResolvedValue(mockTransactions);

      const result = await service.getTransactions(userId, {
        ledgerId: 'ledger-1',
        page: 1,
        pageSize: 20,
      } as any);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should calculate totalPages correctly', async () => {
      ledgersService.getLedger.mockResolvedValue({ id: 'ledger-1', familyId: 'family-1' });
      prisma.transaction.count.mockResolvedValue(45);
      prisma.transaction.findMany.mockResolvedValue(mockTransactions);

      const result = await service.getTransactions(userId, {
        ledgerId: 'ledger-1',
        page: 1,
        pageSize: 20,
      } as any);

      expect(result.totalPages).toBe(3); // Math.ceil(45/20) = 3
    });

    it('should use default page and pageSize when not provided', async () => {
      prisma.transaction.count.mockResolvedValue(0);
      prisma.transaction.findMany.mockResolvedValue([]);

      const result = await service.getTransactions(userId, {} as any);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });
  });

  describe('getTransaction', () => {
    it('should return transaction when found and user has access', async () => {
      const mockTransaction = {
        id: 'txn-1',
        ledgerId: 'ledger-1',
        ledger: { id: 'ledger-1', name: 'Test', familyId: 'family-1' },
        category: null,
        user: { id: 'user-1', nickname: 'TestUser', avatar: null },
      };
      prisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      familiesService.validateFamilyMember.mockResolvedValue(true);

      const result = await service.getTransaction('txn-1', 'user-1');

      expect(result.id).toBe('txn-1');
      expect(familiesService.validateFamilyMember).toHaveBeenCalledWith('family-1', 'user-1');
    });

    it('should throw NotFoundException when transaction does not exist', async () => {
      prisma.transaction.findUnique.mockResolvedValue(null);

      await expect(service.getTransaction('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateTransaction', () => {
    it('should update transaction and mark aiCorrected when category changes', async () => {
      const mockTransaction = {
        id: 'txn-1',
        ledgerId: 'ledger-1',
        categoryId: 'old-cat',
        ledger: { id: 'ledger-1', name: 'Test', familyId: 'family-1' },
        category: null,
        user: null,
      };
      prisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      familiesService.validateFamilyMember.mockResolvedValue(true);
      prisma.transaction.update.mockResolvedValue({
        ...mockTransaction,
        categoryId: 'new-cat',
        aiCorrected: true,
      });

      const result = await service.updateTransaction('txn-1', 'user-1', {
        categoryId: 'new-cat',
      });

      expect(prisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categoryId: 'new-cat',
            aiCorrected: true,
          }),
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'transaction.updated',
        expect.any(Object),
      );
    });
  });

  describe('deleteTransaction', () => {
    it('should delete transaction and emit event', async () => {
      const mockTransaction = {
        id: 'txn-1',
        ledgerId: 'ledger-1',
        ledger: { id: 'ledger-1', name: 'Test', familyId: 'family-1' },
        category: null,
        user: null,
      };
      prisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      familiesService.validateFamilyMember.mockResolvedValue(true);
      prisma.transaction.delete.mockResolvedValue({});

      const result = await service.deleteTransaction('txn-1', 'user-1');

      expect(result.success).toBe(true);
      expect(prisma.transaction.delete).toHaveBeenCalledWith({ where: { id: 'txn-1' } });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'transaction.deleted',
        expect.any(Object),
      );
    });
  });

  describe('quickRecord (NLP parsing)', () => {
    const userId = 'user-1';
    const mockLedger = { id: 'ledger-1', familyId: 'family-1' };

    beforeEach(() => {
      ledgersService.getLedger.mockResolvedValue(mockLedger);
      prisma.transaction.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'txn-quick',
          ledgerId: 'ledger-1',
          userId,
          categoryId: null,
          type: args.data.type,
          amount: args.data.amount,
          date: args.data.date,
          merchant: args.data.merchant,
          note: args.data.note,
          source: 'QUICK_RECORD',
          aiConfidence: args.data.aiConfidence,
          aiCorrected: false,
          createdAt: new Date(),
          category: null,
        }),
      );
    });

    it('should parse "午饭28元" as expense with amount 28', async () => {
      categoriesService.matchCategoryByKeyword.mockResolvedValue(null);

      const result = await service.quickRecord(userId, {
        input: '午饭28元',
        ledgerId: 'ledger-1',
      });

      expect(result.transaction.amount).toBe(28);
      expect(result.transaction.type).toBe('expense');
      expect(result.transaction.source).toBe('quick_record');
      expect(result.undoToken).toBeDefined();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'transaction.created',
        expect.any(Object),
      );
    });

    it('should parse "打车45块" as expense with amount 45', async () => {
      categoriesService.matchCategoryByKeyword.mockResolvedValue(null);

      const result = await service.quickRecord(userId, {
        input: '打车45块',
        ledgerId: 'ledger-1',
      });

      expect(result.transaction.amount).toBe(45);
      expect(result.transaction.type).toBe('expense');
    });

    it('should parse "收到工资5000元" as income with amount 5000', async () => {
      categoriesService.matchCategoryByKeyword.mockResolvedValue(null);

      const result = await service.quickRecord(userId, {
        input: '收到工资5000元',
        ledgerId: 'ledger-1',
      });

      expect(result.transaction.amount).toBe(5000);
      expect(result.transaction.type).toBe('income');
    });

    it('should parse "¥128" as expense with amount 128', async () => {
      categoriesService.matchCategoryByKeyword.mockResolvedValue(null);

      const result = await service.quickRecord(userId, {
        input: '¥128',
        ledgerId: 'ledger-1',
      });

      expect(result.transaction.amount).toBe(128);
      expect(result.transaction.type).toBe('expense');
    });

    it('should parse "花了200" as expense with amount 200', async () => {
      categoriesService.matchCategoryByKeyword.mockResolvedValue(null);

      const result = await service.quickRecord(userId, {
        input: '花了200',
        ledgerId: 'ledger-1',
      });

      expect(result.transaction.amount).toBe(200);
      expect(result.transaction.type).toBe('expense');
    });

    it('should match category keyword and use matched categoryId', async () => {
      categoriesService.matchCategoryByKeyword.mockResolvedValue({
        categoryId: 'cat-food',
        confidence: 0.85,
      });

      const result = await service.quickRecord(userId, {
        input: '午饭28元',
        ledgerId: 'ledger-1',
      });

      // When category is matched, confidence should be min of parsed and matched
      expect(result.confidence).toBeLessThanOrEqual(0.85);
    });

    it('should lower confidence when no category matched', async () => {
      categoriesService.matchCategoryByKeyword.mockResolvedValue(null);

      const result = await service.quickRecord(userId, {
        input: '午饭28元',
        ledgerId: 'ledger-1',
      });

      // Confidence should be reduced by 0.7 factor when no category matched
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should handle date keyword "今天"', async () => {
      categoriesService.matchCategoryByKeyword.mockResolvedValue(null);

      await service.quickRecord(userId, {
        input: '今天午饭28元',
        ledgerId: 'ledger-1',
      });

      const createCall = prisma.transaction.create.mock.calls[0][0];
      const transactionDate = createCall.data.date as Date;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expect(transactionDate.getDate()).toBe(today.getDate());
    });

    it('should handle date keyword "昨天"', async () => {
      categoriesService.matchCategoryByKeyword.mockResolvedValue(null);

      await service.quickRecord(userId, {
        input: '昨天打车30元',
        ledgerId: 'ledger-1',
      });

      const createCall = prisma.transaction.create.mock.calls[0][0];
      const transactionDate = createCall.data.date as Date;
      const yesterday = new Date();
      yesterday.setHours(0, 0, 0, 0);
      yesterday.setDate(yesterday.getDate() - 1);
      expect(transactionDate.getDate()).toBe(yesterday.getDate());
    });

    it('should mark as large expense when amount >= 1000', async () => {
      categoriesService.matchCategoryByKeyword.mockResolvedValue(null);

      await service.quickRecord(userId, {
        input: '买手机花了3999元',
        ledgerId: 'ledger-1',
      });

      const createCall = prisma.transaction.create.mock.calls[0][0];
      expect(createCall.data.isLargeExpense).toBe(true);
      expect(createCall.data.amount).toBe(3999);
    });

    it('should generate an undo token', async () => {
      categoriesService.matchCategoryByKeyword.mockResolvedValue(null);

      const result = await service.quickRecord(userId, {
        input: '午饭28元',
        ledgerId: 'ledger-1',
      });

      expect(result.undoToken).toBeDefined();
      expect(typeof result.undoToken).toBe('string');
      expect(result.undoToken.length).toBeGreaterThan(0);
    });
  });

  describe('batchOperation', () => {
    it('should throw BadRequestException for unsupported operation', async () => {
      await expect(
        service.batchOperation('user-1', {
          operation: 'invalid' as any,
          ids: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle delete operation', async () => {
      // Mock getTransaction + deleteTransaction for each ID
      const mockTransaction = {
        id: 'txn-1',
        ledgerId: 'ledger-1',
        ledger: { id: 'ledger-1', name: 'Test', familyId: 'family-1' },
        category: null,
        user: null,
      };
      prisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      familiesService.validateFamilyMember.mockResolvedValue(true);
      prisma.transaction.delete.mockResolvedValue({});

      const result = await service.batchOperation('user-1', {
        operation: 'delete',
        ids: ['txn-1'],
      });

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(0);
    });
  });

  describe('correctCategory', () => {
    it('should save feedback and update transaction category', async () => {
      const mockTransaction = {
        id: 'txn-1',
        ledgerId: 'ledger-1',
        categoryId: 'old-cat',
        merchant: 'Test Store',
        amount: 50,
        ledger: { id: 'ledger-1', name: 'Test', familyId: 'family-1' },
        category: null,
        user: null,
      };
      prisma.transaction.findUnique.mockResolvedValue(mockTransaction);
      familiesService.validateFamilyMember.mockResolvedValue(true);
      prisma.classificationFeedback.create.mockResolvedValue({});
      prisma.transaction.update.mockResolvedValue({});

      const result = await service.correctCategory('txn-1', 'user-1', 'new-cat');

      expect(result.success).toBe(true);
      expect(prisma.classificationFeedback.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            transactionId: 'txn-1',
            originalCategoryId: 'old-cat',
            correctedCategoryId: 'new-cat',
          }),
        }),
      );
      expect(prisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            categoryId: 'new-cat',
            aiCorrected: true,
          }),
        }),
      );
    });
  });
});

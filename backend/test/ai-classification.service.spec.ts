import { Test, TestingModule } from '@nestjs/testing';
import { AiClassificationService } from '../src/modules/ai/ai-classification.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { CategoriesService } from '../src/modules/categories/categories.service';
import { QwenProvider } from '../src/modules/ai/providers/qwen.provider';

describe('AiClassificationService', () => {
  let service: AiClassificationService;
  let prisma: Record<string, any>;
  let categoriesService: Record<string, any>;
  let llmProvider: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      category: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      classificationFeedback: {
        create: jest.fn(),
      },
    };

    categoriesService = {
      matchCategoryByKeyword: jest.fn(),
    };

    llmProvider = {
      chat: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiClassificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: CategoriesService, useValue: categoriesService },
        { provide: QwenProvider, useValue: llmProvider },
      ],
    }).compile();

    service = module.get<AiClassificationService>(AiClassificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('classifyByRules', () => {
    const request = {
      description: '美团外卖',
      merchant: '美团',
      amount: 35.5,
      type: 'expense' as const,
      familyId: 'family-1',
    };

    it('should match merchant rule and return category with high confidence', async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: 'cat-food',
        name: '餐饮食品',
      });

      const result = await service.classifyByRules(request);

      expect(result.categoryId).toBe('cat-food');
      expect(result.categoryName).toBe('餐饮食品');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.source).toBe('rule');
    });

    it('should match "滴滴" as 交通出行', async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: 'cat-transport',
        name: '交通出行',
      });

      const result = await service.classifyByRules({
        ...request,
        merchant: '滴滴出行',
        description: '打车回家',
      });

      expect(result.categoryId).toBe('cat-transport');
      expect(result.categoryName).toBe('交通出行');
      expect(result.source).toBe('rule');
    });

    it('should match "星巴克" as 餐饮食品', async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: 'cat-food',
        name: '餐饮食品',
      });

      const result = await service.classifyByRules({
        ...request,
        merchant: '星巴克',
        description: '咖啡',
      });

      expect(result.categoryName).toBe('餐饮食品');
    });

    it('should match "房租" as 居家生活 with high confidence', async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: 'cat-home',
        name: '居家生活',
      });

      const result = await service.classifyByRules({
        ...request,
        merchant: '房东',
        description: '房租',
      });

      expect(result.categoryName).toBe('居家生活');
      expect(result.confidence).toBe(0.95);
    });

    it('should fall back to CategoriesService keyword matching when no merchant rule matches', async () => {
      prisma.category.findFirst.mockResolvedValue(null); // No merchant rule match
      categoriesService.matchCategoryByKeyword.mockResolvedValue({
        categoryId: 'cat-keyword',
        confidence: 0.75,
      });
      prisma.category.findUnique.mockResolvedValue({
        id: 'cat-keyword',
        name: '教育培训',
      });

      const result = await service.classifyByRules({
        ...request,
        merchant: '未知商户',
        description: '买书',
      });

      expect(result.categoryId).toBe('cat-keyword');
      expect(result.categoryName).toBe('教育培训');
      expect(result.source).toBe('rule');
    });

    it('should return no match when neither merchant rule nor keyword matching succeeds', async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      categoriesService.matchCategoryByKeyword.mockResolvedValue(null);

      const result = await service.classifyByRules({
        ...request,
        merchant: '完全未知的商户xyz',
        description: '某种奇怪的东西',
      });

      expect(result.categoryId).toBeNull();
      expect(result.categoryName).toBeNull();
      expect(result.confidence).toBe(0.3);
      expect(result.source).toBe('none');
    });

    it('should match "工资" as 薪资收入', async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: 'cat-salary',
        name: '薪资收入',
      });

      const result = await service.classifyByRules({
        ...request,
        merchant: '公司',
        description: '工资',
        type: 'income' as const,
      });

      expect(result.categoryName).toBe('薪资收入');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('classify (hybrid)', () => {
    const request = {
      description: '美团外卖',
      merchant: '美团',
      amount: 35.5,
      type: 'expense' as const,
      familyId: 'family-1',
    };

    it('should use rule result when confidence >= 0.7', async () => {
      prisma.category.findFirst.mockResolvedValue({
        id: 'cat-food',
        name: '餐饮食品',
      });

      const result = await service.classify(request);

      expect(result.source).toBe('rule');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      // LLM should not be called
      expect(llmProvider.chat).not.toHaveBeenCalled();
    });

    it('should fall back to LLM when rule confidence < 0.7', async () => {
      // Rule match fails → confidence = 0.3 (< 0.7)
      prisma.category.findFirst.mockResolvedValue(null);
      categoriesService.matchCategoryByKeyword.mockResolvedValue(null);

      // LLM mock: return a valid category ID
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-other', name: '其他支出' },
      ]);
      llmProvider.chat.mockResolvedValue({
        content: 'cat-other',
        model: 'qwen-turbo',
        usage: { promptTokens: 100, completionTokens: 10, totalTokens: 110 },
        finishReason: 'stop',
      });

      const result = await service.classify(request);

      expect(result.source).toBe('llm');
      expect(result.confidence).toBe(0.75);
      expect(llmProvider.chat).toHaveBeenCalled();
    });

    it('should return rule result when LLM fails', async () => {
      // Rule match fails
      prisma.category.findFirst.mockResolvedValue(null);
      categoriesService.matchCategoryByKeyword.mockResolvedValue(null);

      // LLM throws error
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-other', name: '其他支出' },
      ]);
      llmProvider.chat.mockRejectedValue(new Error('LLM API error'));

      const result = await service.classify(request);

      // Should fall back to rule result (even though confidence is low)
      expect(result.source).toBe('none');
      expect(result.confidence).toBe(0.3);
    });
  });

  describe('classifyByLLM', () => {
    const request = {
      description: '某种特殊消费',
      merchant: '特殊商户',
      amount: 100,
      type: 'expense' as const,
      familyId: 'family-1',
    };

    it('should return LLM classification when valid category ID returned', async () => {
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-1', name: '餐饮食品' },
        { id: 'cat-2', name: '交通出行' },
      ]);
      llmProvider.chat.mockResolvedValue({
        content: 'cat-1',
        model: 'qwen-turbo',
        usage: { promptTokens: 50, completionTokens: 5, totalTokens: 55 },
        finishReason: 'stop',
      });

      const result = await service.classifyByLLM(request);

      expect(result.categoryId).toBe('cat-1');
      expect(result.categoryName).toBe('餐饮食品');
      expect(result.confidence).toBe(0.75);
      expect(result.source).toBe('llm');
    });

    it('should match by name when LLM returns invalid ID but valid name', async () => {
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-1', name: '餐饮食品' },
        { id: 'cat-2', name: '交通出行' },
      ]);
      llmProvider.chat.mockResolvedValue({
        content: '餐饮食品',
        model: 'qwen-turbo',
        usage: { promptTokens: 50, completionTokens: 5, totalTokens: 55 },
        finishReason: 'stop',
      });

      const result = await service.classifyByLLM(request);

      expect(result.categoryId).toBe('cat-1');
      expect(result.categoryName).toBe('餐饮食品');
      expect(result.source).toBe('llm');
    });

    it('should return no match when LLM returns empty content', async () => {
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-1', name: '餐饮食品' },
      ]);
      llmProvider.chat.mockResolvedValue({
        content: '',
        model: 'qwen-turbo',
        usage: { promptTokens: 50, completionTokens: 0, totalTokens: 50 },
        finishReason: 'stop',
      });

      const result = await service.classifyByLLM(request);

      expect(result.categoryId).toBeNull();
      expect(result.source).toBe('none');
      expect(result.confidence).toBe(0.3);
    });

    it('should return no match when no categories exist for family', async () => {
      prisma.category.findMany.mockResolvedValue([]);

      const result = await service.classifyByLLM(request);

      expect(result.categoryId).toBeNull();
      expect(result.source).toBe('none');
      expect(llmProvider.chat).not.toHaveBeenCalled();
    });

    it('should return no match when LLM returns invalid ID and no name match', async () => {
      prisma.category.findMany.mockResolvedValue([
        { id: 'cat-1', name: '餐饮食品' },
        { id: 'cat-2', name: '交通出行' },
      ]);
      llmProvider.chat.mockResolvedValue({
        content: 'invalid-id-that-doesnt-match',
        model: 'qwen-turbo',
        usage: { promptTokens: 50, completionTokens: 5, totalTokens: 55 },
        finishReason: 'stop',
      });

      const result = await service.classifyByLLM(request);

      expect(result.categoryId).toBeNull();
      expect(result.source).toBe('none');
      expect(result.confidence).toBe(0.3);
    });
  });

  describe('saveFeedback', () => {
    it('should save classification feedback to database', async () => {
      const feedback = {
        transactionId: 'txn-1',
        userId: 'user-1',
        originalCategoryId: 'cat-old',
        correctedCategoryId: 'cat-new',
        merchant: '美团',
        amount: 35.5,
      };

      prisma.classificationFeedback.create.mockResolvedValue({});

      await service.saveFeedback(feedback);

      expect(prisma.classificationFeedback.create).toHaveBeenCalledWith({
        data: {
          transactionId: 'txn-1',
          userId: 'user-1',
          originalCategoryId: 'cat-old',
          correctedCategoryId: 'cat-new',
          merchant: '美团',
          amount: 35.5,
        },
      });
    });
  });
});

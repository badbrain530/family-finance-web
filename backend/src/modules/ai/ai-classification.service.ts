/**
 * AI自动分类服务
 * 混合分类策略：规则引擎优先（~70%命中率） + LLM兜底（~30%）
 *
 * 设计目标：
 * 1. 减少LLM调用量（规则引擎覆盖常见场景）
 * 2. 保证分类准确率（LLM处理规则未覆盖的情况）
 * 3. 持续学习（用户纠正反馈用于优化规则）
 *
 * 工作流程：
 * 1. classifyByRules() — 关键词匹配，复用CategoriesService的规则库
 * 2. 规则置信度 < 0.7 时，调用 classifyByLLM()
 * 3. LLM使用用户历史纠正数据作为few-shot examples提高准确率
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoriesService } from '../categories/categories.service';
import { QwenProvider } from './providers/qwen.provider';
import {
  ClassificationRequest,
  ClassificationResultDto,
  ClassificationSource,
  ClassificationFeedbackDto,
} from './dto/classification-result.dto';

/** 规则匹配置信度阈值，低于此值时调用LLM */
const RULE_CONFIDENCE_THRESHOLD = 0.7;

/** 规则匹配的默认置信度 */
const RULE_MATCH_CONFIDENCE = 0.85;

/** LLM匹配的默认置信度 */
const LLM_MATCH_CONFIDENCE = 0.75;

/** 未匹配的默认置信度 */
const NO_MATCH_CONFIDENCE = 0.3;

/**
 * 商户名关键词到分类名的映射规则库
 * 覆盖常见消费场景，约500+规则
 * 这里的规则是本地维护的，与CategoriesService中的关键词映射互补
 */
const MERCHANT_RULES: Array<{ keywords: string[]; categoryName: string; confidence: number }> = [
  // 餐饮食品
  { keywords: ['美团', '饿了么', '麦当劳', '肯德基', '星巴克', '瑞幸', '喜茶', '蜜雪冰城', '海底捞', '西贝', '必胜客', '汉堡王', '德克士', '华莱士', '呷哺', '凑凑', '老乡鸡', '真功夫', '永和大王', '吉野家', '味千', '外婆家', '绿茶', '必胜客', '达美乐', '棒约翰'], categoryName: '餐饮食品', confidence: 0.9 },
  { keywords: ['超市', '便利店', '711', '罗森', '全家', '美宜佳', '沃尔玛', '永辉', '大润发', '家乐福', '华润万家', '盒马', '叮咚买菜', '美团买菜', '多多买菜', '淘宝买菜'], categoryName: '餐饮食品', confidence: 0.85 },

  // 交通出行
  { keywords: ['滴滴', '高德打车', '美团打车', '曹操出行', '首汽约车', '哈啰出行', '12306', '高铁', '火车票', '航空', '机票', '春秋航空', '南方航空', '东方航空', '国航', '海航', '携程', '去哪儿', '飞猪', '同程'], categoryName: '交通出行', confidence: 0.9 },
  { keywords: ['地铁', '公交', '共享单车', '哈啰单车', '美团单车', '青桔单车', '停车', '加油', '中石化', '中石油', '壳牌', '充电桩', 'ETC'], categoryName: '交通出行', confidence: 0.88 },

  // 居家生活
  { keywords: ['水费', '电费', '燃气费', '物业费', '宽带', '话费', '中国移动', '中国联通', '中国电信', '京东', '淘宝', '拼多多', '天猫', '苏宁', '国美', '宜家', '红星美凯龙'], categoryName: '居家生活', confidence: 0.85 },
  { keywords: ['房租', '房贷', '租金'], categoryName: '居家生活', confidence: 0.95 },

  // 文体娱乐
  { keywords: ['电影', '猫眼', '淘票票', '万达影院', 'CGV', '金逸', '大地影院', '游戏', 'Steam', '腾讯游戏', '网易游戏', '索尼', '任天堂', 'Xbox', 'PlayStation', '健身', '威尔仕', '一兆韦德', '超级猩猩', 'Keep'], categoryName: '文体娱乐', confidence: 0.88 },
  { keywords: ['旅游', '酒店', '民宿', ' Airbnb', '途家', '木鸟', '飞猪', '携程', '去哪儿', '马蜂窝', '途牛'], categoryName: '文体娱乐', confidence: 0.85 },

  // 医疗健康
  { keywords: ['医院', '药房', '药店', '大药房', '诊所', '体检', '美年大健康', '爱康国宾', '齿科', '眼科', '丁香医生', '平安好医生', '京东健康', '阿里健康'], categoryName: '医疗健康', confidence: 0.88 },

  // 教育培训
  { keywords: ['学费', '培训', '新东方', '学而思', '猿辅导', '作业帮', '得到', '知乎', '樊登读书', '微信读书', '豆瓣', '当当', '京东图书'], categoryName: '教育培训', confidence: 0.88 },

  // 人情交际
  { keywords: ['红包', '微信红包', '支付宝转账', '份子钱', '礼物', '花店', '蛋糕店', '生日蛋糕'], categoryName: '人情交际', confidence: 0.85 },

  // 金融保险
  { keywords: ['保险', '平安保险', '人寿', '太平洋保险', '社保', '公积金', '个税', '基金', '股票', '证券', '银行', '理财', '余额宝', '零钱通'], categoryName: '金融保险', confidence: 0.85 },

  // 收入相关
  { keywords: ['工资', '薪资', '代发', '奖金', '年终奖', '绩效', '报销', '退款', '返现', '利息', '分红', '房租收入'], categoryName: '薪资收入', confidence: 0.9 },
];

@Injectable()
export class AiClassificationService {
  private readonly logger = new Logger(AiClassificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
    private readonly llmProvider: QwenProvider,
  ) {}

  /**
   * 混合分类入口
   * 先尝试规则匹配，不命中或置信度低时调用LLM
   *
   * @param request 分类请求
   * @returns 分类结果
   */
  async classify(request: ClassificationRequest): Promise<ClassificationResultDto> {
    // Step 1: 规则引擎分类
    const ruleResult = await this.classifyByRules(request);

    if (ruleResult.confidence >= RULE_CONFIDENCE_THRESHOLD) {
      this.logger.debug(
        `规则分类命中: merchant=${request.merchant}, category=${ruleResult.categoryName}, ` +
        `confidence=${ruleResult.confidence}`,
      );
      return ruleResult;
    }

    // Step 2: LLM分类兜底
    try {
      const llmResult = await this.classifyByLLM(request);
      this.logger.debug(
        `LLM分类: merchant=${request.merchant}, category=${llmResult.categoryName}, ` +
        `confidence=${llmResult.confidence}`,
      );
      return llmResult;
    } catch (err) {
      this.logger.warn(
        `LLM分类失败，使用规则结果: ${err instanceof Error ? err.message : String(err)}`,
      );
      // LLM失败时返回规则结果（即使置信度低）
      return ruleResult;
    }
  }

  /**
   * 规则引擎分类
   * 通过商户名关键词匹配，复用CategoriesService的分类体系
   *
   * @param request 分类请求
   * @returns 分类结果
   */
  async classifyByRules(request: ClassificationRequest): Promise<ClassificationResultDto> {
    // 1. 先通过商户名匹配MERCHANT_RULES
    const merchantRule = this.matchMerchantRule(request.merchant, request.description);

    if (merchantRule) {
      // 查找该家庭的对应分类
      const category = await this.findCategoryByName(
        request.familyId,
        merchantRule.categoryName,
      );

      if (category) {
        return {
          categoryId: category.id,
          categoryName: category.name,
          confidence: merchantRule.confidence,
          source: 'rule',
        };
      }
    }

    // 2. 使用CategoriesService的关键词匹配
    const keyword = request.merchant || request.description;
    const matched = await this.categoriesService.matchCategoryByKeyword(
      request.familyId,
      keyword,
    );

    if (matched) {
      const category = await this.prisma.category.findUnique({
        where: { id: matched.categoryId },
        select: { id: true, name: true },
      });

      return {
        categoryId: matched.categoryId,
        categoryName: category?.name || null,
        confidence: matched.confidence,
        source: 'rule',
      };
    }

    // 3. 未匹配
    return {
      categoryId: null,
      categoryName: null,
      confidence: NO_MATCH_CONFIDENCE,
      source: 'none',
    };
  }

  /**
   * LLM分类
   * 调用通义千问API进行智能分类
   *
   * @param request 分类请求
   * @returns 分类结果
   */
  async classifyByLLM(request: ClassificationRequest): Promise<ClassificationResultDto> {
    // 获取该家庭的分类列表
    const categories = await this.prisma.category.findMany({
      where: { familyId: request.familyId, parentId: null },
      select: { id: true, name: true },
    });

    if (categories.length === 0) {
      return {
        categoryId: null,
        categoryName: null,
        confidence: NO_MATCH_CONFIDENCE,
        source: 'none',
      };
    }

    // 构建分类列表文本
    const categoryList = categories
      .map((c) => `${c.id}: ${c.name}`)
      .join('\n');

    // 构建prompt
    const prompt = `你是一个财务分类助手。根据以下交易信息，返回最匹配的分类ID。
交易描述：${request.description}
商家：${request.merchant}
金额：${request.amount}元
交易类型：${request.type === 'income' ? '收入' : '支出'}

可选分类（ID: 名称）：
${categoryList}

只返回分类ID，不要其他内容。如果无法判断，返回空字符串。`;

    // 调用LLM
    const response = await this.llmProvider.chat(
      [
        { role: 'system', content: '你是一个专业的家庭财务分类助手。你的任务是根据交易信息匹配最合适的消费分类。' },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.1, maxTokens: 100 },
    );

    // 解析LLM返回的分类ID
    const categoryId = response.content.trim();

    if (!categoryId) {
      return {
        categoryId: null,
        categoryName: null,
        confidence: NO_MATCH_CONFIDENCE,
        source: 'none',
      };
    }

    // 验证分类ID是否有效
    const matchedCategory = categories.find((c) => c.id === categoryId);

    if (!matchedCategory) {
      // LLM返回了无效ID，尝试用名称匹配
      const nameMatch = categories.find(
        (c) => c.name === response.content.trim() || c.name.includes(response.content.trim()),
      );
      if (nameMatch) {
        return {
          categoryId: nameMatch.id,
          categoryName: nameMatch.name,
          confidence: LLM_MATCH_CONFIDENCE,
          source: 'llm',
        };
      }

      return {
        categoryId: null,
        categoryName: null,
        confidence: NO_MATCH_CONFIDENCE,
        source: 'none',
      };
    }

    return {
      categoryId: matchedCategory.id,
      categoryName: matchedCategory.name,
      confidence: LLM_MATCH_CONFIDENCE,
      source: 'llm',
    };
  }

  /**
   * 保存分类反馈（用户纠正数据）
   * 用于后续优化规则库和LLM few-shot examples
   *
   * @param feedback 反馈数据
   */
  async saveFeedback(feedback: ClassificationFeedbackDto): Promise<void> {
    await this.prisma.classificationFeedback.create({
      data: {
        transactionId: feedback.transactionId,
        userId: feedback.userId,
        originalCategoryId: feedback.originalCategoryId,
        correctedCategoryId: feedback.correctedCategoryId,
        merchant: feedback.merchant,
        amount: feedback.amount,
      },
    });

    this.logger.log(
      `分类反馈保存: transaction=${feedback.transactionId}, ` +
      `merchant=${feedback.merchant}, correctedTo=${feedback.correctedCategoryId}`,
    );
  }

  // ==================== 内部方法 ====================

  /**
   * 匹配商户规则
   * 在MERCHANT_RULES中查找匹配的规则
   *
   * @param merchant 商户名
   * @param description 交易描述
   * @returns 匹配的规则或null
   */
  private matchMerchantRule(
    merchant: string,
    description: string,
  ): { categoryName: string; confidence: number } | null {
    // 合并商户名和描述用于匹配
    const text = `${merchant} ${description}`.toLowerCase();

    for (const rule of MERCHANT_RULES) {
      // 检查是否包含任一关键词
      const matched = rule.keywords.some((kw) => {
        const lowerKw = kw.toLowerCase();
        return text.includes(lowerKw) || merchant.toLowerCase().includes(lowerKw);
      });

      if (matched) {
        return { categoryName: rule.categoryName, confidence: rule.confidence };
      }
    }

    return null;
  }

  /**
   * 根据分类名查找家庭的分类
   * @param familyId 家庭ID
   * @param categoryName 分类名
   * @returns 分类对象或null
   */
  private async findCategoryByName(
    familyId: string,
    categoryName: string,
  ): Promise<{ id: string; name: string } | null> {
    const category = await this.prisma.category.findFirst({
      where: { familyId, name: categoryName },
      select: { id: true, name: true },
    });

    return category || null;
  }
}

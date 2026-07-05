import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { FamiliesService } from '../families/families.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';

/**
 * 国标默认分类体系
 * 支出8大类 + 收入4类
 */
interface DefaultCategoryDef {
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
  children?: { name: string; icon: string; color: string }[];
}

/** 默认支出分类（国标8大类） */
const DEFAULT_EXPENSE_CATEGORIES: DefaultCategoryDef[] = [
  {
    name: '餐饮食品',
    icon: 'utensils',
    color: '#FF6B6B',
    type: 'expense',
    children: [
      { name: '三餐', icon: 'rice', color: '#FF6B6B' },
      { name: '零食饮料', icon: 'coffee', color: '#FF8E8E' },
      { name: '果蔬生鲜', icon: 'apple', color: '#FFA5A5' },
      { name: '外卖', icon: 'bike', color: '#FFB8B8' },
    ],
  },
  {
    name: '交通出行',
    icon: 'car',
    color: '#4ECDC4',
    type: 'expense',
    children: [
      { name: '公共交通', icon: 'bus', color: '#4ECDC4' },
      { name: '打车出行', icon: 'taxi', color: '#6BD5CE' },
      { name: '加油停车', icon: 'fuel', color: '#88DDD7' },
      { name: '火车机票', icon: 'plane', color: '#A0E5E0' },
    ],
  },
  {
    name: '居家生活',
    icon: 'home',
    color: '#45B7D1',
    type: 'expense',
    children: [
      { name: '水电燃气', icon: 'zap', color: '#45B7D1' },
      { name: '日用品', icon: 'shopping-cart', color: '#62C4DA' },
      { name: '房租房贷', icon: 'key', color: '#7FD0E3' },
      { name: '家居家电', icon: 'sofa', color: '#9BDCED' },
    ],
  },
  {
    name: '文体娱乐',
    icon: 'gamepad',
    color: '#FFA07A',
    type: 'expense',
    children: [
      { name: '电影演出', icon: 'film', color: '#FFA07A' },
      { name: '游戏充值', icon: 'gamepad-2', color: '#FFB08D' },
      { name: '运动健身', icon: 'dumbbell', color: '#FFC0A0' },
      { name: '旅游度假', icon: 'map', color: '#FFD0B3' },
    ],
  },
  {
    name: '医疗健康',
    icon: 'heart-pulse',
    color: '#98D8C8',
    type: 'expense',
    children: [
      { name: '门诊就医', icon: 'stethoscope', color: '#98D8C8' },
      { name: '药品保健', icon: 'pill', color: '#ADDED0' },
      { name: '体检检查', icon: 'clipboard', color: '#C2E5D8' },
    ],
  },
  {
    name: '教育培训',
    icon: 'graduation-cap',
    color: '#F7DC6F',
    type: 'expense',
    children: [
      { name: '学费培训', icon: 'book-open', color: '#F7DC6F' },
      { name: '书籍文具', icon: 'book', color: '#F9E38B' },
      { name: '在线课程', icon: 'monitor', color: '#FBEAA7' },
    ],
  },
  {
    name: '人情交际',
    icon: 'users',
    color: '#BB8FCE',
    type: 'expense',
    children: [
      { name: '红包礼金', icon: 'gift', color: '#BB8FCE' },
      { name: '请客吃饭', icon: 'wine', color: '#C9A0D8' },
      { name: '礼物', icon: 'package', color: '#D7B0E2' },
    ],
  },
  {
    name: '金融保险',
    icon: 'shield',
    color: '#85C1E9',
    type: 'expense',
    children: [
      { name: '保险费用', icon: 'shield-check', color: '#85C1E9' },
      { name: '投资理财', icon: 'trending-up', color: '#9DCEF0' },
      { name: '税费', icon: 'receipt', color: '#B5DBF5' },
    ],
  },
];

/** 默认收入分类（4类） */
const DEFAULT_INCOME_CATEGORIES: DefaultCategoryDef[] = [
  {
    name: '薪资收入',
    icon: 'wallet',
    color: '#27AE60',
    type: 'income',
    children: [
      { name: '工资', icon: 'banknote', color: '#27AE60' },
      { name: '奖金', icon: 'award', color: '#3BC47A' },
      { name: '年终奖', icon: 'trophy', color: '#52CE8C' },
    ],
  },
  {
    name: '投资收益',
    icon: 'trending-up',
    color: '#2980B9',
    type: 'income',
    children: [
      { name: '股票基金', icon: 'line-chart', color: '#2980B9' },
      { name: '利息', icon: 'percent', color: '#4A9DCE' },
      { name: '分红', icon: 'pie-chart', color: '#6BB5E0' },
    ],
  },
  {
    name: '兼职收入',
    icon: 'briefcase',
    color: '#E67E22',
    type: 'income',
    children: [
      { name: '自由职业', icon: 'laptop', color: '#E67E22' },
      { name: '咨询顾问', icon: 'message-circle', color: '#EB9536' },
    ],
  },
  {
    name: '其他收入',
    icon: 'plus-circle',
    color: '#95A5A6',
    type: 'income',
    children: [
      { name: '退款返现', icon: 'rotate-ccw', color: '#95A5A6' },
      { name: '红包', icon: 'gift', color: '#A8B5B6' },
      { name: '其他', icon: 'more-horizontal', color: '#BBC8C9' },
    ],
  },
];

/** 获取全部默认分类 */
const ALL_DEFAULT_CATEGORIES = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES];

/**
 * 分类服务
 * 管理家庭分类体系，支持树形结构、自定义分类、国标默认初始化
 */
@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly familiesService: FamiliesService,
  ) {}

  /**
   * 获取分类列表（树形结构）
   * @param familyId 家庭ID
   * @param userId 请求者用户ID
   * @returns 分类树
   */
  async getCategories(familyId: string, userId: string) {
    await this.familiesService.validateFamilyMember(familyId, userId);

    const categories = await this.prisma.category.findMany({
      where: { familyId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    // 构建树形结构
    return this.buildCategoryTree(categories);
  }

  /**
   * 创建自定义分类
   * @param userId 操作者用户ID
   * @param dto 分类信息
   * @returns 创建的分类
   */
  async createCategory(userId: string, dto: CreateCategoryDto) {
    await this.familiesService.validateFamilyMember(dto.familyId, userId);

    // 如果有父分类，验证父分类存在且属于同一家庭
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException('父分类不存在');
      }
      if (parent.familyId !== dto.familyId) {
        throw new BadRequestException('父分类不属于该家庭');
      }
    }

    // 获取当前最大排序序号
    const maxSortOrder = await this.prisma.category.aggregate({
      where: { familyId: dto.familyId, parentId: dto.parentId || null },
      _max: { sortOrder: true },
    });

    const sortOrder = dto.sortOrder ?? (maxSortOrder._max.sortOrder ?? -1) + 1;

    return this.prisma.category.create({
      data: {
        familyId: dto.familyId,
        parentId: dto.parentId || null,
        name: dto.name,
        icon: dto.icon,
        color: dto.color,
        sortOrder,
        isSystem: false,
      },
    });
  }

  /**
   * 更新分类
   * @param categoryId 分类ID
   * @param userId 操作者用户ID
   * @param dto 更新信息
   * @returns 更新后的分类
   */
  async updateCategory(categoryId: string, userId: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('分类不存在');
    }

    // 验证权限
    await this.familiesService.validateFamilyMember(category.familyId, userId);

    // 系统分类的名称不能修改
    if (category.isSystem && dto.name !== undefined && dto.name !== category.name) {
      throw new BadRequestException('系统默认分类名称不能修改');
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.icon !== undefined) updateData.icon = dto.icon;
    if (dto.color !== undefined) updateData.color = dto.color;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;

    return this.prisma.category.update({
      where: { id: categoryId },
      data: updateData,
    });
  }

  /**
   * 删除分类
   * 系统分类不可删除；有子分类或关联交易的分类不可删除
   * @param categoryId 分类ID
   * @param userId 操作者用户ID
   * @returns 操作结果
   */
  async deleteCategory(categoryId: string, userId: string): Promise<{ success: boolean }> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: { children: true, transactions: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('分类不存在');
    }

    // 验证权限
    await this.familiesService.validateFamilyMember(category.familyId, userId);

    // 系统分类不可删除
    if (category.isSystem) {
      throw new BadRequestException('系统默认分类不能删除');
    }

    // 有子分类不可删除
    if (category._count.children > 0) {
      throw new BadRequestException('请先删除子分类');
    }

    // 有关联交易不可删除
    if (category._count.transactions > 0) {
      throw new BadRequestException(
        `该分类下有 ${category._count.transactions} 条交易记录，无法删除`,
      );
    }

    await this.prisma.category.delete({
      where: { id: categoryId },
    });

    return { success: true };
  }

  /**
   * 初始化家庭默认分类（国标8大类支出 + 4类收入）
   * 创建家庭时自动调用（通过监听 family.created 事件）
   * @param familyId 家庭ID
   */
  @OnEvent('family.created')
  async onFamilyCreated(payload: { familyId: string; userId: string }): Promise<void> {
    await this.initDefaultCategories(payload.familyId);
  }

  async initDefaultCategories(familyId: string): Promise<void> {
    // 检查是否已初始化
    const existingCount = await this.prisma.category.count({
      where: { familyId, isSystem: true },
    });

    if (existingCount > 0) {
      this.logger.log(`家庭 ${familyId} 已有系统分类，跳过初始化`);
      return;
    }

    // 批量创建一级分类和子分类
    for (let i = 0; i < ALL_DEFAULT_CATEGORIES.length; i++) {
      const def = ALL_DEFAULT_CATEGORIES[i];
      const parent = await this.prisma.category.create({
        data: {
          familyId,
          parentId: null,
          name: def.name,
          icon: def.icon,
          color: def.color,
          sortOrder: i,
          isSystem: true,
        },
      });

      // 创建子分类
      if (def.children) {
        for (let j = 0; j < def.children.length; j++) {
          const child = def.children[j];
          await this.prisma.category.create({
            data: {
              familyId,
              parentId: parent.id,
              name: child.name,
              icon: child.icon,
              color: child.color,
              sortOrder: j,
              isSystem: true,
            },
          });
        }
      }
    }

    this.logger.log(`家庭 ${familyId} 默认分类初始化完成: ${ALL_DEFAULT_CATEGORIES.length}个一级分类`);
  }

  /**
   * 手动触发初始化（API端点）
   * @param familyId 家庭ID
   * @param userId 操作者用户ID
   * @returns 操作结果
   */
  async initCategories(familyId: string, userId: string): Promise<{ success: boolean; count: number }> {
    await this.familiesService.validateFamilyRole(familyId, userId, ['OWNER', 'ADMIN']);
    await this.initDefaultCategories(familyId);

    const count = await this.prisma.category.count({
      where: { familyId, isSystem: true },
    });

    return { success: true, count };
  }

  /**
   * 根据关键词匹配分类（用于NLP快捷记账的分类推断）
   * @param familyId 家庭ID
   * @param keyword 关键词（如"午餐"、"打车"）
   * @returns 匹配的分类ID和置信度，null表示未匹配
   */
  async matchCategoryByKeyword(
    familyId: string,
    keyword: string,
  ): Promise<{ categoryId: string; confidence: number } | null> {
    // 关键词到分类的映射表
    const keywordMap: Record<string, string[]> = {
      '餐饮食品': ['饭', '餐', '食', '吃', '午餐', '晚餐', '早餐', '外卖', '米', '面', '菜', '零食', '饮料', '咖啡', '奶茶', '水果'],
      '交通出行': ['车', '地铁', '公交', '打车', '出租', '滴滴', '加油', '停车', '高铁', '火车', '飞机', '机票', '骑行', '单车'],
      '居家生活': ['水电', '燃气', '物业', '房租', '房租房贷', '日用品', '纸巾', '洗衣', '家电', '家具', '装修'],
      '文体娱乐': ['电影', '演出', '游戏', '健身', '运动', '旅游', '度假', 'KTV', '酒吧'],
      '医疗健康': ['医院', '看病', '药', '门诊', '体检', '挂号', '保健'],
      '教育培训': ['学费', '培训', '课程', '书', '文具', '学习', '考试'],
      '人情交际': ['红包', '礼金', '请客', '礼物', '份子钱', '聚餐'],
      '金融保险': ['保险', '投资', '理财', '税费', '基金', '股票'],
    };

    const categories = await this.prisma.category.findMany({
      where: { familyId, parentId: null },
    });

    for (const [catName, keywords] of Object.entries(keywordMap)) {
      const matched = keywords.some((kw) => keyword.includes(kw));
      if (matched) {
        const category = categories.find((c) => c.name === catName);
        if (category) {
          // 置信度根据匹配精确度计算
          const confidence = keyword.length <= 2 ? 0.85 : 0.75;
          return { categoryId: category.id, confidence };
        }
      }
    }

    return null;
  }

  // ==================== 内部工具方法 ====================

  /**
   * 构建分类树形结构
   * @param categories 扁平分类列表
   * @returns 树形结构
   */
  private buildCategoryTree(categories: any[]): any[] {
    const map = new Map<string, any>();
    const roots: any[] = [];

    // 初始化每个节点
    for (const cat of categories) {
      map.set(cat.id, { ...cat, children: [] });
    }

    // 构建父子关系
    for (const cat of categories) {
      const node = map.get(cat.id);
      if (cat.parentId && map.has(cat.parentId)) {
        map.get(cat.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }
}

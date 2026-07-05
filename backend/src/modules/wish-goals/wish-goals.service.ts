import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FamiliesService } from '../families/families.service';
import {
  CreateWishGoalDto,
  UpdateWishGoalDto,
  WishGoalProgress,
} from './dto/create-wish-goal.dto';

/** 默认图标 */
const DEFAULT_ICON = '🎯';
/** 默认颜色 */
const DEFAULT_COLOR = '#6366F1';

/**
 * 心愿目标服务
 * 核心功能：心愿目标CRUD、进度计算、预算关联
 *
 * 心愿目标关联预算：
 * - 创建预算时可指定wishGoalId，将预算金额分配到心愿目标
 * - 当月预算执行时，已使用的预算金额会累加到心愿目标的currentAmount
 * - 通过updateWishGoalProgress方法在预算检查时更新心愿目标进度
 */
@Injectable()
export class WishGoalsService {
  private readonly logger = new Logger(WishGoalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly familiesService: FamiliesService,
  ) {}

  // ==================== 心愿目标CRUD ====================

  /**
   * 创建心愿目标
   * @param userId 操作者用户ID
   * @param familyId 家庭ID
   * @param dto 心愿目标信息
   * @returns 创建的心愿目标
   */
  async createWishGoal(userId: string, familyId: string, dto: CreateWishGoalDto) {
    await this.familiesService.validateFamilyMember(familyId, userId);

    const wishGoal = await this.prisma.wishGoal.create({
      data: {
        familyId,
        name: dto.name,
        targetAmount: dto.targetAmount,
        currentAmount: 0,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
        icon: dto.icon || DEFAULT_ICON,
        color: dto.color || DEFAULT_COLOR,
        isCompleted: false,
      },
    });

    this.logger.log(
      `心愿目标创建: family=${familyId}, name=${dto.name}, ` +
      `target=${dto.targetAmount}, by=${userId}`,
    );

    return {
      ...wishGoal,
      targetAmount: Number(wishGoal.targetAmount),
      currentAmount: Number(wishGoal.currentAmount),
    };
  }

  /**
   * 获取心愿目标列表
   * @param userId 用户ID
   * @param familyId 家庭ID
   * @param includeCompleted 是否包含已完成的目标
   * @returns 心愿目标列表（含进度）
   */
  async getWishGoals(
    userId: string,
    familyId: string,
    includeCompleted: boolean = true,
  ): Promise<WishGoalProgress[]> {
    await this.familiesService.validateFamilyMember(familyId, userId);

    const where: Record<string, unknown> = { familyId };
    if (!includeCompleted) {
      where.isCompleted = false;
    }

    const wishGoals = await this.prisma.wishGoal.findMany({
      where,
      orderBy: [{ isCompleted: 'asc' }, { createdAt: 'desc' }],
    });

    return wishGoals.map((g) => this.toProgress(g));
  }

  /**
   * 获取单个心愿目标
   * @param userId 用户ID
   * @param wishGoalId 心愿目标ID
   * @returns 心愿目标（含进度）
   */
  async getWishGoal(userId: string, wishGoalId: string): Promise<WishGoalProgress> {
    const wishGoal = await this.prisma.wishGoal.findUnique({
      where: { id: wishGoalId },
    });

    if (!wishGoal) {
      throw new NotFoundException('心愿目标不存在');
    }

    await this.familiesService.validateFamilyMember(wishGoal.familyId, userId);

    return this.toProgress(wishGoal);
  }

  /**
   * 更新心愿目标
   * @param userId 操作者用户ID
   * @param wishGoalId 心愿目标ID
   * @param dto 更新信息
   * @returns 更新后的心愿目标
   */
  async updateWishGoal(userId: string, wishGoalId: string, dto: UpdateWishGoalDto) {
    const wishGoal = await this.prisma.wishGoal.findUnique({
      where: { id: wishGoalId },
    });

    if (!wishGoal) {
      throw new NotFoundException('心愿目标不存在');
    }

    await this.familiesService.validateFamilyMember(wishGoal.familyId, userId);

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.targetAmount !== undefined) updateData.targetAmount = dto.targetAmount;
    if (dto.targetDate !== undefined) {
      updateData.targetDate = dto.targetDate ? new Date(dto.targetDate) : null;
    }
    if (dto.currentAmount !== undefined) {
      updateData.currentAmount = dto.currentAmount;
      // 如果已达目标，标记为完成
      if (dto.currentAmount >= Number(wishGoal.targetAmount)) {
        updateData.isCompleted = true;
      }
    }

    const updated = await this.prisma.wishGoal.update({
      where: { id: wishGoalId },
      data: updateData,
    });

    this.logger.log(`心愿目标更新: ${wishGoalId}, by=${userId}`);

    return {
      ...updated,
      targetAmount: Number(updated.targetAmount),
      currentAmount: Number(updated.currentAmount),
    };
  }

  /**
   * 删除心愿目标
   * @param userId 操作者用户ID
   * @param wishGoalId 心愿目标ID
   * @returns 操作结果
   */
  async deleteWishGoal(userId: string, wishGoalId: string): Promise<{ success: boolean }> {
    const wishGoal = await this.prisma.wishGoal.findUnique({
      where: { id: wishGoalId },
    });

    if (!wishGoal) {
      throw new NotFoundException('心愿目标不存在');
    }

    await this.familiesService.validateFamilyMember(wishGoal.familyId, userId);

    // 解除关联的预算
    await this.prisma.budget.updateMany({
      where: { wishGoalId },
      data: { wishGoalId: null },
    });

    await this.prisma.wishGoal.delete({
      where: { id: wishGoalId },
    });

    this.logger.log(`心愿目标删除: ${wishGoalId}, by=${userId}`);

    return { success: true };
  }

  // ==================== 进度计算 ====================

  /**
   * 更新心愿目标进度
   * 汇总关联预算的已存金额，更新currentAmount
   * @param wishGoalId 心愿目标ID
   */
  async updateWishGoalProgress(wishGoalId: string): Promise<void> {
    const wishGoal = await this.prisma.wishGoal.findUnique({
      where: { id: wishGoalId },
    });

    if (!wishGoal) {
      return;
    }

    // 查询关联该心愿目标的所有预算
    const budgets = await this.prisma.budget.findMany({
      where: { wishGoalId },
      select: { amount: true },
    });

    // 汇总预算金额作为已存金额
    const totalAllocated = budgets.reduce(
      (sum, b) => sum + Number(b.amount),
      0,
    );

    // 更新心愿目标的currentAmount
    const isCompleted = totalAllocated >= Number(wishGoal.targetAmount);

    await this.prisma.wishGoal.update({
      where: { id: wishGoalId },
      data: {
        currentAmount: totalAllocated,
        isCompleted,
      },
    });

    this.logger.log(
      `心愿目标进度更新: ${wishGoalId}, current=${totalAllocated}, ` +
      `target=${wishGoal.targetAmount}, completed=${isCompleted}`,
    );
  }

  // ==================== 私有方法 ====================

  /**
   * 将Prisma模型转换为进度DTO
   */
  private toProgress(goal: {
    id: string;
    name: string;
    targetAmount: { toString(): string } | number;
    currentAmount: { toString(): string } | number;
    targetDate: Date | null;
    icon: string;
    color: string;
    isCompleted: boolean;
  }): WishGoalProgress {
    const target = typeof goal.targetAmount === 'number' ? goal.targetAmount : Number(goal.targetAmount);
    const current = typeof goal.currentAmount === 'number' ? goal.currentAmount : Number(goal.currentAmount);
    const percentage = target > 0 ? (current / target) * 100 : 0;
    const remaining = target - current;

    return {
      id: goal.id,
      name: goal.name,
      currentAmount: Math.round(current * 100) / 100,
      targetAmount: Math.round(target * 100) / 100,
      percentage: Math.round(percentage * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      targetDate: goal.targetDate ? goal.targetDate.toISOString() : null,
      icon: goal.icon,
      color: goal.color,
      isCompleted: goal.isCompleted,
    };
  }
}

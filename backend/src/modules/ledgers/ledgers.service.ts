import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FamiliesService } from '../families/families.service';
import { CreateLedgerDto } from './dto/create-ledger.dto';

/**
 * 账本服务
 * 管理家庭共同账本和个人子账本
 */
@Injectable()
export class LedgersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly familiesService: FamiliesService,
  ) {}

  /**
   * 创建账本
   * @param userId 创建者用户ID
   * @param dto 账本信息
   * @returns 创建的账本
   */
  async createLedger(userId: string, dto: CreateLedgerDto) {
    // 验证用户是否为家庭成员
    await this.familiesService.validateFamilyMember(dto.familyId, userId);

    const type = dto.type || 'personal';

    // 共同账本只能由 owner/admin 创建
    if (type === 'shared') {
      await this.familiesService.validateFamilyRole(dto.familyId, userId, ['OWNER', 'ADMIN']);
    }

    // 个人子账本设置 ownerId
    const ownerId = type === 'personal' ? userId : null;

    const ledger = await this.prisma.ledger.create({
      data: {
        familyId: dto.familyId,
        ownerId,
        type: type === 'shared' ? 'SHARED' : 'PERSONAL',
        name: dto.name,
      },
    });

    return ledger;
  }

  /**
   * 获取家庭下的账本列表
   * @param familyId 家庭ID
   * @param userId 请求者用户ID
   * @returns 账本列表（共同账本 + 当前用户的个人账本）
   */
  async getLedgers(familyId: string, userId: string) {
    // 验证成员身份
    await this.familiesService.validateFamilyMember(familyId, userId);

    // 查询共同账本 + 当前用户的个人账本
    const ledgers = await this.prisma.ledger.findMany({
      where: {
        familyId,
        OR: [
          { type: 'SHARED' },
          { type: 'PERSONAL', ownerId: userId },
        ],
      },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    return ledgers;
  }

  /**
   * 获取账本详情
   * @param ledgerId 账本ID
   * @param userId 请求者用户ID
   * @returns 账本详情
   */
  async getLedger(ledgerId: string, userId: string) {
    const ledger = await this.prisma.ledger.findUnique({
      where: { id: ledgerId },
      include: {
        family: true,
        _count: {
          select: { transactions: true },
        },
      },
    });

    if (!ledger) {
      throw new NotFoundException('账本不存在');
    }

    // 验证权限
    await this.familiesService.validateFamilyMember(ledger.familyId, userId);

    // 个人账本只有 owner 可查看
    if (ledger.type === 'PERSONAL' && ledger.ownerId !== userId) {
      throw new BadRequestException('无权查看他人的个人账本');
    }

    return ledger;
  }

  /**
   * 更新账本
   * @param ledgerId 账本ID
   * @param userId 操作者用户ID
   * @param name 新名称
   * @returns 更新后的账本
   */
  async updateLedger(ledgerId: string, userId: string, name: string) {
    const ledger = await this.getLedger(ledgerId, userId);

    // 个人账本只有 owner 可修改
    if (ledger.type === 'PERSONAL' && ledger.ownerId !== userId) {
      throw new BadRequestException('无权修改他人的个人账本');
    }

    // 共同账本需要 owner/admin 权限
    if (ledger.type === 'SHARED') {
      await this.familiesService.validateFamilyRole(ledger.familyId, userId, ['OWNER', 'ADMIN']);
    }

    return this.prisma.ledger.update({
      where: { id: ledgerId },
      data: { name },
    });
  }

  /**
   * 删除账本（需验证无关联交易或级联处理）
   * @param ledgerId 账本ID
   * @param userId 操作者用户ID
   * @returns 操作结果
   */
  async deleteLedger(ledgerId: string, userId: string): Promise<{ success: boolean }> {
    const ledger = await this.getLedger(ledgerId, userId);

    // 权限校验
    if (ledger.type === 'PERSONAL' && ledger.ownerId !== userId) {
      throw new BadRequestException('无权删除他人的个人账本');
    }
    if (ledger.type === 'SHARED') {
      await this.familiesService.validateFamilyRole(ledger.familyId, userId, ['OWNER', 'ADMIN']);
    }

    // 检查是否有关联交易
    if (ledger._count.transactions > 0) {
      throw new BadRequestException(
        `该账本下有 ${ledger._count.transactions} 条交易记录，无法删除。请先迁移或删除交易。`,
      );
    }

    await this.prisma.ledger.delete({
      where: { id: ledgerId },
    });

    return { success: true };
  }
}

import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FamiliesService } from '../families/families.service';
import { CreateLedgerDto } from './dto/create-ledger.dto';

/**
 * 账本服务
 * 管理家庭共同账本和个人子账本
 */
@Injectable()
export class LedgersService {
  private readonly logger = new Logger(LedgersService.name);

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

    // 家庭共同账本是协作场景，任何家庭成员（OWNER/ADMIN/MEMBER/VIEWER 均含）
    // 均可创建共享账本，此处不再按角色限制，避免普通成员（如通过邀请码加入的
    // MEMBER）在创建共享账本时收到 403 而落入"无账本"死路。
    // 成员身份已由上方的 validateFamilyMember 校验，个人账本仅本人可见。

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
    // 与前端当前家庭来源（getCurrentFamily -> getUserFamilies）保持同源判定：
    // 基于 userId 查询其真实所属家庭列表，而非 validateFamilyMember 的复合唯一索引查询。
    // 两套判定路径不一致时，前端能拿到 family 并发起请求，后端却 403，造成「账本加载失败」。
    const userFamilies = await this.familiesService.getUserFamilies(userId);
    const belongs = userFamilies.some((f) => f.id === familyId);
    this.logger.warn(
      `[getLedgers] familyId=${familyId} userId=${userId} belongs=${belongs} ` +
        `userFamilies=${userFamilies.map((f) => f.id).join(',')}`,
    );
    if (!belongs) {
      throw new ForbiddenException({
        code: 3002,
        message: '您不是该家庭的成员',
      });
    }

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
   * 级联删除账本及其全部子数据（交易 / 账户 / 周期规则 / 贷款 / 导入记录）。
   *
   * 采用「应用层手动级联」而非依赖 schema 的 onDelete 级联：线上财务库的外键多为
   * Restrict，且改动 schema / 新增 Prisma migration 风险高（本项目最小变更原则）。
   * 在单个 $transaction 内按依赖顺序清除子数据、最后删除账本本身，保证原子性，
   * 任意一步失败整体回滚，不会残留孤儿数据。
   *
   * 顺序之所以固定：Transaction / RecurringRule / Loan / ImportRecord 均挂 ledgerId 真实
   * 关系且为 Restrict，必须先于 ledger 删除；Account.ledgerId 是松散 String 字段（无 Prisma
   * 关系），同样用 deleteMany 手动清理。
   *
   * 权限校验沿用 getLedger：PERSONAL 仅 owner 可删，SHARED 需 OWNER / ADMIN。
   *
   * @param ledgerId 账本ID
   * @param userId 操作者用户ID
   * @returns 操作结果
   */
  async deleteLedger(ledgerId: string, userId: string): Promise<{ success: boolean }> {
    const ledger = await this.getLedger(ledgerId, userId);

    // 权限校验：PERSONAL 仅 owner 可删；SHARED 需 OWNER / ADMIN
    if (ledger.type === 'PERSONAL' && ledger.ownerId !== userId) {
      throw new BadRequestException('无权删除他人的个人账本');
    }
    if (ledger.type === 'SHARED') {
      await this.familiesService.validateFamilyRole(ledger.familyId, userId, ['OWNER', 'ADMIN']);
    }

    // 应用层手动级联删除：单个事务内按依赖顺序清除子数据，最后删账本本身。
    // 即便账本下已有交易 / 账户等数据，也不再拒绝，而是一并永久删除。
    // 注意：被删模型可能还挂着各自的子表（均为 ON DELETE RESTRICT 且无 ledgerId 字段），
    // 必须「先删孙子，再删儿子，最后删账本」，否则真实库会抛 FK 约束错误并整体回滚。
    await this.prisma.$transaction(async (tx) => {
      // 分类反馈依赖交易（RESTRICT，且无 ledgerId），需先按本账本交易ID清掉
      const txIds = await tx.transaction.findMany({
        where: { ledgerId },
        select: { id: true },
      });
      if (txIds.length) {
        await tx.classificationFeedback.deleteMany({
          where: { transactionId: { in: txIds.map((t) => t.id) } },
        });
      }
      // 交易
      await tx.transaction.deleteMany({ where: { ledgerId } });

      // 贷款还款计划依赖贷款（RESTRICT，且无 ledgerId），需先按本账本贷款ID清掉
      const loanIds = await tx.loan.findMany({
        where: { ledgerId },
        select: { id: true },
      });
      if (loanIds.length) {
        await tx.loanSchedule.deleteMany({
          where: { loanId: { in: loanIds.map((l) => l.id) } },
        });
      }
      // 贷款
      await tx.loan.deleteMany({ where: { ledgerId } });

      // 账户、周期规则、导入记录（按原样清理）
      await tx.account.deleteMany({ where: { ledgerId } });
      await tx.recurringRule.deleteMany({ where: { ledgerId } });
      await tx.importRecord.deleteMany({ where: { ledgerId } });

      // 账本本身
      await tx.ledger.delete({ where: { id: ledgerId } });
    });

    return { success: true };
  }
}

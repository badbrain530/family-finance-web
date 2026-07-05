import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { nanoid } from 'nanoid';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFamilyDto, UpdateFamilyDto, UpdateMemberRoleDto } from './dto/create-family.dto';
import { JoinFamilyDto } from './dto/join-family.dto';

/** 邀请码有效期（7天，毫秒） */
const INVITE_CODE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/** 有效角色列表 */
const VALID_ROLES = ['admin', 'member', 'viewer'] as const;

/**
 * 家庭服务
 * 管理家庭创建、成员邀请、加入、角色管理
 */
@Injectable()
export class FamiliesService {
  private readonly logger = new Logger(FamiliesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 创建家庭
   * 创建者自动成为 owner 成员，同时创建家庭共同账本
   * @param userId 创建者用户ID
   * @param dto 家庭信息
   * @returns 创建的家庭信息
   */
  async createFamily(userId: string, dto: CreateFamilyDto) {
    // 生成6位邀请码（大写字母+数字）
    const inviteCode = this.generateRandomInviteCode();
    const inviteCodeExpiry = new Date(Date.now() + INVITE_CODE_EXPIRY_MS);

    // 使用事务：创建家庭 + 添加owner成员 + 创建共同账本
    const family = await this.prisma.$transaction(async (tx) => {
      // 创建家庭
      const newFamily = await tx.family.create({
        data: {
          name: dto.name,
          ownerId: userId,
          avatar: dto.avatar || null,
          inviteCode,
          inviteCodeExpiry,
        },
      });

      // 添加创建者为 owner 成员
      await tx.familyMember.create({
        data: {
          familyId: newFamily.id,
          userId,
          role: 'OWNER',
        },
      });

      // 创建家庭共同账本
      await tx.ledger.create({
        data: {
          familyId: newFamily.id,
          ownerId: null,
          type: 'SHARED',
          name: '家庭账本',
        },
      });

      return newFamily;
    });

    this.logger.log(`家庭创建成功: ${family.id} (${family.name}), owner: ${userId}`);

    // 发出事件：家庭创建（CategoriesService监听后初始化默认分类）
    this.eventEmitter.emit('family.created', { familyId: family.id, userId });

    return family;
  }

  /**
   * 获取家庭信息
   * @param familyId 家庭ID
   * @param userId 请求者用户ID（用于权限校验）
   * @returns 家庭信息
   */
  async getFamily(familyId: string, userId: string) {
    // 验证是否为家庭成员
    await this.validateFamilyMember(familyId, userId);

    const family = await this.prisma.family.findUnique({
      where: { id: familyId },
      include: {
        owner: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
    });

    if (!family) {
      throw new NotFoundException('家庭不存在');
    }

    return family;
  }

  /**
   * 获取用户创建/加入的家庭列表
   * @param userId 用户ID
   * @returns 家庭列表
   */
  async getUserFamilies(userId: string) {
    const members = await this.prisma.familyMember.findMany({
      where: { userId },
      include: {
        family: {
          include: {
            owner: {
              select: { id: true, nickname: true, avatar: true },
            },
            _count: {
              select: { members: true, ledgers: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return members.map((m) => ({
      ...m.family,
      role: m.role,
      joinedAt: m.joinedAt,
      memberCount: m.family._count.members,
      ledgerCount: m.family._count.ledgers,
    }));
  }

  /**
   * 更新家庭信息
   * @param familyId 家庭ID
   * @param userId 操作者用户ID
   * @param dto 更新信息
   * @returns 更新后的家庭信息
   */
  async updateFamily(familyId: string, userId: string, dto: UpdateFamilyDto) {
    // 验证权限：只有 owner 或 admin 可以更新
    await this.validateFamilyRole(familyId, userId, ['OWNER', 'ADMIN']);

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.avatar !== undefined) updateData.avatar = dto.avatar;

    return this.prisma.family.update({
      where: { id: familyId },
      data: updateData,
    });
  }

  /**
   * 生成新的邀请码
   * @param familyId 家庭ID
   * @param userId 操作者用户ID
   * @returns 邀请码和过期时间
   */
  async generateInviteCode(familyId: string, userId: string) {
    // 验证权限
    await this.validateFamilyRole(familyId, userId, ['OWNER', 'ADMIN']);

    const inviteCode = this.generateRandomInviteCode();
    const inviteCodeExpiry = new Date(Date.now() + INVITE_CODE_EXPIRY_MS);

    await this.prisma.family.update({
      where: { id: familyId },
      data: { inviteCode, inviteCodeExpiry },
    });

    return {
      inviteCode,
      expireAt: inviteCodeExpiry,
    };
  }

  /**
   * 通过邀请码加入家庭
   * @param userId 用户ID
   * @param dto 邀请码
   * @returns 加入的家庭成员记录
   */
  async joinFamily(userId: string, dto: JoinFamilyDto) {
    // 查找邀请码对应的家庭
    const family = await this.prisma.family.findUnique({
      where: { inviteCode: dto.inviteCode },
    });

    if (!family) {
      throw new BadRequestException({
        code: 3001,
        message: '邀请码无效',
      });
    }

    // 检查邀请码是否过期
    if (family.inviteCodeExpiry < new Date()) {
      throw new BadRequestException({
        code: 3001,
        message: '邀请码已过期',
      });
    }

    // 检查是否已是家庭成员
    const existingMember = await this.prisma.familyMember.findUnique({
      where: {
        familyId_userId: { familyId: family.id, userId },
      },
    });

    if (existingMember) {
      throw new ConflictException('您已经是该家庭的成员');
    }

    // 加入家庭（默认 MEMBER 角色）
    const member = await this.prisma.familyMember.create({
      data: {
        familyId: family.id,
        userId,
        role: 'MEMBER',
      },
      include: {
        family: true,
        user: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
    });

    this.logger.log(`用户 ${userId} 加入家庭 ${family.id}`);

    return member;
  }

  /**
   * 获取家庭成员列表
   * @param familyId 家庭ID
   * @param userId 请求者用户ID
   * @returns 成员列表
   */
  async getMembers(familyId: string, userId: string) {
    await this.validateFamilyMember(familyId, userId);

    const members = await this.prisma.familyMember.findMany({
      where: { familyId },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });

    return members;
  }

  /**
   * 更新成员角色
   * @param familyId 家庭ID
   * @param targetUserId 被操作的用户ID
   * @param operatorUserId 操作者用户ID
   * @param dto 新角色
   * @returns 更新后的成员记录
   */
  async updateMemberRole(
    familyId: string,
    targetUserId: string,
    operatorUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    // 验证角色值有效
    const targetRole = dto.role.toUpperCase();
    if (!VALID_ROLES.includes(dto.role as typeof VALID_ROLES[number])) {
      throw new BadRequestException('无效的角色类型');
    }

    // 验证操作者权限：只有 owner 可以修改角色
    const operator = await this.validateFamilyRole(familyId, operatorUserId, ['OWNER']);

    // 不能修改 owner 的角色
    const targetMember = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId: targetUserId } },
    });

    if (!targetMember) {
      throw new NotFoundException('该用户不是家庭成员');
    }

    if (targetMember.role === 'OWNER') {
      throw new ForbiddenException('不能修改家庭创建者的角色');
    }

    const updated = await this.prisma.familyMember.update({
      where: { id: targetMember.id },
      data: { role: targetRole as 'ADMIN' | 'MEMBER' | 'VIEWER' },
      include: {
        user: {
          select: { id: true, nickname: true, avatar: true },
        },
      },
    });

    this.logger.log(`成员角色更新: family=${familyId}, user=${targetUserId}, role=${targetRole}, by=${operatorUserId}`);

    return updated;
  }

  /**
   * 移除家庭成员
   * @param familyId 家庭ID
   * @param targetUserId 被移除的用户ID
   * @param operatorUserId 操作者用户ID
   * @returns 操作结果
   */
  async removeMember(familyId: string, targetUserId: string, operatorUserId: string) {
    // 验证操作者权限
    await this.validateFamilyRole(familyId, operatorUserId, ['OWNER', 'ADMIN']);

    // 不能移除 owner
    const targetMember = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId: targetUserId } },
    });

    if (!targetMember) {
      throw new NotFoundException('该用户不是家庭成员');
    }

    if (targetMember.role === 'OWNER') {
      throw new ForbiddenException('不能移除家庭创建者');
    }

    // 不能移除自己（应该用退出家庭功能）
    if (targetUserId === operatorUserId) {
      throw new BadRequestException('不能移除自己，请使用退出家庭功能');
    }

    await this.prisma.familyMember.delete({
      where: { id: targetMember.id },
    });

    this.logger.log(`成员移除: family=${familyId}, user=${targetUserId}, by=${operatorUserId}`);

    return { success: true };
  }

  // ==================== 内部工具方法 ====================

  /**
   * 验证用户是否为家庭成员
   * @throws ForbiddenException 如果不是成员
   */
  async validateFamilyMember(familyId: string, userId: string) {
    const member = await this.prisma.familyMember.findUnique({
      where: { familyId_userId: { familyId, userId } },
    });

    if (!member) {
      throw new ForbiddenException({
        code: 3002,
        message: '您不是该家庭的成员',
      });
    }

    return member;
  }

  /**
   * 验证用户角色是否满足要求
   * @returns 成员记录
   * @throws ForbiddenException 如果权限不足
   */
  async validateFamilyRole(
    familyId: string,
    userId: string,
    allowedRoles: string[],
  ) {
    const member = await this.validateFamilyMember(familyId, userId);

    if (!allowedRoles.includes(member.role)) {
      throw new ForbiddenException({
        code: 3003,
        message: '权限等级不足',
      });
    }

    return member;
  }

  /**
   * 生成6位邀请码（大写字母+数字，排除易混淆字符）
   */
  private generateRandomInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
}

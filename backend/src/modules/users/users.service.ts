import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto, ChangePasswordDto } from './dto/update-user.dto';

/**
 * 用户服务
 * 管理用户个人信息和安全设置
 */
@Injectable()
export class UsersService {
  private readonly BCRYPT_SALT_ROUNDS = 10;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取用户个人资料
   * @param userId 用户ID
   * @returns 用户信息（不含密码）
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        nickname: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  /**
   * 更新用户个人资料
   * @param userId 用户ID
   * @param dto 更新信息
   * @returns 更新后的用户信息
   */
  async updateProfile(userId: string, dto: UpdateUserDto) {
    // 验证用户存在
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new NotFoundException('用户不存在');
    }

    // 构建更新数据（仅更新非undefined字段）
    const updateData: Record<string, unknown> = {};
    if (dto.nickname !== undefined) updateData.nickname = dto.nickname;
    if (dto.avatar !== undefined) updateData.avatar = dto.avatar;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        phone: true,
        email: true,
        nickname: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  /**
   * 修改密码
   * @param userId 用户ID
   * @param dto 旧密码 + 新密码
   * @returns 操作结果
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (!user.passwordHash) {
      throw new BadRequestException('当前账号未设置密码');
    }

    // 验证旧密码
    const isOldPasswordValid = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('旧密码不正确');
    }

    // 新旧密码不能相同
    if (dto.oldPassword === dto.newPassword) {
      throw new BadRequestException('新密码不能与旧密码相同');
    }

    // 加密新密码
    const newPasswordHash = await bcrypt.hash(dto.newPassword, this.BCRYPT_SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // 撤销所有该用户的Refresh Token（强制重新登录）
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    return { success: true };
  }
}

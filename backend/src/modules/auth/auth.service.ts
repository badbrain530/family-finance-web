import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from './decorators/current-user.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/**
 * 认证返回结果
 */
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    nickname: string;
    avatar: string | null;
    phone: string | null;
    email: string | null;
  };
}

/**
 * 认证服务
 * 负责用户注册、登录、Token刷新、登出等核心认证逻辑
 *
 * JWT双Token机制：
 * - Access Token: 15分钟有效期，通过 Authorization: Bearer 传递
 * - Refresh Token: 7天有效期，存储在HttpOnly Cookie中，数据库记录用于撤销
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_SALT_ROUNDS = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 用户注册
   * @param dto 注册信息（手机号或邮箱 + 密码 + 昵称）
   * @returns 认证结果（含双Token和用户信息）
   */
  async register(dto: RegisterDto): Promise<AuthResult> {
    // 验证至少提供了手机号或邮箱
    if (!dto.phone && !dto.email) {
      throw new BadRequestException('手机号和邮箱至少填写一项');
    }

    // 检查手机号是否已注册
    if (dto.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (existingPhone) {
        throw new ConflictException({
          code: 2003,
          message: '该手机号已被注册',
        });
      }
    }

    // 检查邮箱是否已注册
    if (dto.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existingEmail) {
        throw new ConflictException({
          code: 2003,
          message: '该邮箱已被注册',
        });
      }
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_SALT_ROUNDS);

    // 创建用户
    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone || null,
        email: dto.email || null,
        passwordHash,
        nickname: dto.nickname,
      },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        phone: true,
        email: true,
      },
    });

    this.logger.log(`新用户注册成功: ${user.id} (${user.nickname})`);

    // 生成双Token
    const tokens = await this.generateTokens(user.id, user.nickname);

    return {
      ...tokens,
      user,
    };
  }

  /**
   * 用户登录
   * @param dto 登录信息（手机号或邮箱 + 密码）
   * @returns 认证结果（含双Token和用户信息）
   */
  async login(dto: LoginDto): Promise<AuthResult> {
    // 根据手机号或邮箱查找用户
    let user: any = null;
    if (dto.phone) {
      user = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
    } else if (dto.email) {
      user = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
    }

    if (!user) {
      throw new UnauthorizedException({
        code: 2004,
        message: '账号或密码错误',
      });
    }

    // 验证密码
    if (!user.passwordHash) {
      throw new UnauthorizedException({
        code: 2004,
        message: '该账号未设置密码，请使用其他方式登录',
      });
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        code: 2004,
        message: '账号或密码错误',
      });
    }

    this.logger.log(`用户登录成功: ${user.id} (${user.nickname})`);

    // 生成双Token
    const tokens = await this.generateTokens(user.id, user.nickname);

    return {
      ...tokens,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        phone: user.phone,
        email: user.email,
      },
    };
  }

  /**
   * 刷新Token
   * @param refreshToken 旧的刷新令牌
   * @returns 新的双Token
   */
  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    if (!refreshToken) {
      throw new UnauthorizedException({
        code: 2002,
        message: '刷新令牌不能为空',
      });
    }

    // 验证Refresh Token的JWT签名
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
      });
    } catch {
      throw new UnauthorizedException({
        code: 2002,
        message: '刷新令牌无效或已过期',
      });
    }

    // 查找数据库中的Refresh Token记录，验证未被撤销
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!tokenRecord || tokenRecord.isRevoked) {
      throw new UnauthorizedException({
        code: 2002,
        message: '刷新令牌已被撤销',
      });
    }

    // 验证Token未过期
    if (tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 2002,
        message: '刷新令牌已过期',
      });
    }

    // 撤销旧Token（防止重放攻击）
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true },
    });

    // 生成新的双Token
    return this.generateTokens(payload.sub, payload.nickname);
  }

  /**
   * 用户登出
   * 撤销Refresh Token，前端清除Access Token
   * @param refreshToken 刷新令牌
   * @returns 操作结果
   */
  async logout(refreshToken: string): Promise<{ success: boolean }> {
    if (!refreshToken) {
      return { success: true };
    }

    // 查找并撤销Refresh Token
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (tokenRecord && !tokenRecord.isRevoked) {
      await this.prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { isRevoked: true },
      });
      this.logger.log(`用户登出成功: ${tokenRecord.userId}`);
    }

    return { success: true };
  }

  /**
   * 生成JWT双Token
   * @param userId 用户ID
   * @param nickname 用户昵称
   * @returns accessToken + refreshToken
   */
  private async generateTokens(
    userId: string,
    nickname: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: userId,
      nickname,
    };

    // 生成Access Token（15分钟）
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET', 'dev-access-secret'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    // 生成Refresh Token（7天）
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    // 将Refresh Token存入数据库，用于撤销管理
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        id: nanoid(),
        userId,
        token: refreshToken,
        expiresAt,
        isRevoked: false,
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * 根据用户ID获取用户信息
   * @param userId 用户ID
   * @returns 用户信息（不含密码）
   */
  async getUserById(userId: string) {
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
      throw new UnauthorizedException('用户不存在');
    }

    return user;
  }
}

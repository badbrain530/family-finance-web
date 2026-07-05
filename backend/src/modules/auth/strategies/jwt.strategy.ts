import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import type { JwtPayload, AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * JWT Passport 策略
 * 从 Authorization: Bearer <token> 头中提取并验证 Access Token
 * 验证通过后将用户信息注入到 request.user
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET', 'dev-access-secret'),
    });
  }

  /**
   * Passport 自动调用此方法验证 payload
   * @param payload JWT 解码后的载荷
   * @returns 注入到 request.user 的对象
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException('无效的访问令牌');
    }

    // 验证用户是否仍然存在
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, nickname: true },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return {
      userId: user.id,
      nickname: user.nickname,
    };
  }
}

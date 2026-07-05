import {
  Controller,
  Post,
  Body,
  Res,
  HttpStatus,
  Get,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from './decorators/current-user.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

/**
 * 认证控制器
 * 提供注册、登录、Token刷新、登出接口
 *
 * Refresh Token 通过 HttpOnly Cookie 传递，防止XSS攻击
 */
@Controller('auth')
export class AuthController {
  /** Refresh Token Cookie名称 */
  private static readonly REFRESH_TOKEN_COOKIE = 'refresh_token';
  /** Cookie有效期7天（毫秒） */
  private static readonly COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

  constructor(private readonly authService: AuthService) {}

  /**
   * 用户注册
   * POST /api/auth/register
   */
  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);

    // 将refreshToken设置到HttpOnly Cookie
    res.cookie(AuthController.REFRESH_TOKEN_COOKIE, result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: AuthController.COOKIE_MAX_AGE,
      path: '/',
    });

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  /**
   * 用户登录
   * POST /api/auth/login
   */
  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);

    // 将refreshToken设置到HttpOnly Cookie
    res.cookie(AuthController.REFRESH_TOKEN_COOKIE, result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: AuthController.COOKIE_MAX_AGE,
      path: '/',
    });

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  /**
   * 刷新Token
   * POST /api/auth/refresh
   * 从Cookie或请求体中获取refreshToken
   */
  @Public()
  @Post('refresh')
  async refresh(
    @Body() body: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 优先从请求体获取，其次从Cookie获取
    const refreshToken = body?.refreshToken;

    if (!refreshToken) {
      res.status(HttpStatus.UNAUTHORIZED);
      return {
        code: 2002,
        data: null,
        message: '刷新令牌不能为空',
      };
    }

    try {
      const tokens = await this.authService.refresh(refreshToken);

      // 更新Cookie中的refreshToken
      res.cookie(AuthController.REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: AuthController.COOKIE_MAX_AGE,
        path: '/',
      });

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    } catch (error) {
      // 清除无效的Cookie
      res.clearCookie(AuthController.REFRESH_TOKEN_COOKIE, { path: '/' });
      throw error;
    }
  }

  /**
   * 用户登出
   * POST /api/auth/logout
   * 撤销Refresh Token并清除Cookie
   */
  @Post('logout')
  async logout(
    @Body() body: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = body?.refreshToken;
    await this.authService.logout(refreshToken);

    // 清除Cookie
    res.clearCookie(AuthController.REFRESH_TOKEN_COOKIE, { path: '/' });

    return { success: true };
  }

  /**
   * 获取当前登录用户信息
   * GET /api/auth/me
   */
  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getUserById(user.userId);
  }
}

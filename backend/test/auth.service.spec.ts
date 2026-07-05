import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

// Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

// Mock nanoid
jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'mock-nanoid-id'),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: Record<string, any>;
  let jwtService: Record<string, any>;
  let configService: Record<string, any>;

  beforeEach(async () => {
    // Create mock PrismaService with nested models
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string, defaultValue?: string) => defaultValue),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      phone: '13800138000',
      password: 'Test1234',
      nickname: 'TestUser',
    };

    const mockUser = {
      id: 'user-1',
      phone: '13800138000',
      email: null,
      nickname: 'TestUser',
      avatar: null,
    };

    it('should register a new user with phone successfully', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register(registerDto);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.id).toBe('user-1');
      expect(result.user.nickname).toBe('TestUser');
      expect(bcrypt.hash).toHaveBeenCalledWith('Test1234', 10);
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should register a new user with email successfully', async () => {
      const emailDto = {
        email: 'test@example.com',
        password: 'Test1234',
        nickname: 'EmailUser',
      };
      const mockEmailUser = {
        id: 'user-2',
        phone: null,
        email: 'test@example.com',
        nickname: 'EmailUser',
        avatar: null,
      };

      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue(mockEmailUser);
      jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register(emailDto);

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.phone).toBeNull();
    });

    it('should throw BadRequestException when neither phone nor email is provided', async () => {
      const invalidDto = {
        password: 'Test1234',
        nickname: 'NoContact',
      };

      await expect(service.register(invalidDto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException when phone is already registered', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when email is already registered', async () => {
      const emailDto = {
        email: 'existing@example.com',
        password: 'Test1234',
        nickname: 'TestUser',
      };

      // email check returns existing user (no phone check since dto has no phone)
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'existing-user' }); // email check

      await expect(service.register(emailDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should generate both access and refresh tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register(registerDto);

      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      // First call: access token
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        1,
        { sub: 'user-1', nickname: 'TestUser' },
        expect.objectContaining({
          secret: 'dev-access-secret',
          expiresIn: '15m',
        }),
      );
      // Second call: refresh token
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        2,
        { sub: 'user-1', nickname: 'TestUser' },
        expect.objectContaining({
          secret: 'dev-refresh-secret',
          expiresIn: '7d',
        }),
      );
    });
  });

  describe('login', () => {
    const loginDto = {
      phone: '13800138000',
      password: 'Test1234',
    };

    const mockUser = {
      id: 'user-1',
      phone: '13800138000',
      email: null,
      nickname: 'TestUser',
      avatar: null,
      passwordHash: 'hashed-password',
    };

    it('should login successfully with phone and correct password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.id).toBe('user-1');
      expect(result.user.nickname).toBe('TestUser');
      expect(bcrypt.compare).toHaveBeenCalledWith('Test1234', 'hashed-password');
    });

    it('should login successfully with email', async () => {
      const emailLoginDto = {
        email: 'test@example.com',
        password: 'Test1234',
      };
      const mockEmailUser = {
        ...mockUser,
        phone: null,
        email: 'test@example.com',
      };

      prisma.user.findUnique.mockResolvedValue(mockEmailUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token');
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login(emailLoginDto);

      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw UnauthorizedException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user has no passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: null,
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    const validRefreshToken = 'valid-refresh-token';
    const mockPayload = { sub: 'user-1', nickname: 'TestUser' };
    const mockTokenRecord = {
      id: 'token-1',
      userId: 'user-1',
      token: validRefreshToken,
      isRevoked: false,
      expiresAt: new Date(Date.now() + 86400000), // Tomorrow
    };

    it('should refresh tokens successfully', async () => {
      jwtService.verify.mockReturnValue(mockPayload);
      prisma.refreshToken.findUnique.mockResolvedValue(mockTokenRecord);
      prisma.refreshToken.update.mockResolvedValue({});
      jwtService.sign.mockReturnValueOnce('new-access-token').mockReturnValueOnce('new-refresh-token');
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh(validRefreshToken);

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      // Old token should be revoked
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-1' },
        data: { isRevoked: true },
      });
    });

    it('should throw UnauthorizedException when refresh token is empty', async () => {
      await expect(service.refresh('')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when JWT verification fails', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refresh(validRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token record not found', async () => {
      jwtService.verify.mockReturnValue(mockPayload);
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh(validRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token is revoked', async () => {
      jwtService.verify.mockReturnValue(mockPayload);
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...mockTokenRecord,
        isRevoked: true,
      });

      await expect(service.refresh(validRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token is expired', async () => {
      jwtService.verify.mockReturnValue(mockPayload);
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...mockTokenRecord,
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
      });

      await expect(service.refresh(validRefreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke an active refresh token', async () => {
      const mockTokenRecord = {
        id: 'token-1',
        userId: 'user-1',
        isRevoked: false,
      };
      prisma.refreshToken.findUnique.mockResolvedValue(mockTokenRecord);
      prisma.refreshToken.update.mockResolvedValue({});

      const result = await service.logout('some-token');

      expect(result.success).toBe(true);
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'token-1' },
        data: { isRevoked: true },
      });
    });

    it('should return success when token is already revoked', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'token-1',
        isRevoked: true,
      });

      const result = await service.logout('revoked-token');

      expect(result.success).toBe(true);
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });

    it('should return success when token is empty', async () => {
      const result = await service.logout('');

      expect(result.success).toBe(true);
      expect(prisma.refreshToken.findUnique).not.toHaveBeenCalled();
    });

    it('should return success when token record not found', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      const result = await service.logout('nonexistent-token');

      expect(result.success).toBe(true);
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: 'user-1',
        phone: '13800138000',
        email: null,
        nickname: 'TestUser',
        avatar: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserById('user-1');

      expect(result.id).toBe('user-1');
      expect(result.nickname).toBe('TestUser');
    });

    it('should throw UnauthorizedException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById('nonexistent')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});

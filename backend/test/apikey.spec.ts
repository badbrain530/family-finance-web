import { ApiKeyService, ApiKeyScope } from '../src/modules/apikey/apikey.service';
import { NotFoundException } from '@nestjs/common';
import { randomBytes, scryptSync } from 'crypto';

/**
 * ApiKeyService 单元测试（P0 焦点 1：生成 / 校验 / 吊销）
 *
 * 不连真实库：PrismaService 与 FamiliesService 全部用 jest.fn() 替身。
 * 重点验证：
 *   1) generateKey（createKey）返回明文 ak_live_xxx，且库存仅 scrypt 哈希（明文≠存储值）；
 *   2) verifyKey（validateKey）对正确 Key 返回有效 ctx（familyId/userId/scope），
 *      对错误 Key 返回 null；
 *   3) 吊销后 validateKey 失效；
 *   4) scope 正确解析为 READONLY / READWRITE。
 */

const FAMILY_ID = 'fam-1';
const USER_ID = 'user-1';

/** 复刻 ApiKeyService.verifyKey 的哈希算法，用于在测试中构造可校验的候选记录 */
function hashKeyForTest(plainKey: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(plainKey, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let prisma: Record<string, any>;
  let familiesService: Record<string, any>;

  beforeEach(() => {
    prisma = {
      apiKey: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    familiesService = {
      getCurrentFamily: jest.fn().mockResolvedValue({ id: FAMILY_ID }),
    };
    service = new ApiKeyService(prisma as any, familiesService as any);
  });

  afterEach(() => jest.clearAllMocks());

  // ============ 生成 / 哈希 ============
  describe('createKey（生成 + scrypt 哈希）', () => {
    it('返回明文 Key 且格式为 ak_live_ + 32 字符 base64url', async () => {
      const storedHash = hashKeyForTest('ak_live_dummytoken0000000000000000');
      prisma.apiKey.create.mockResolvedValue({
        id: 'key-1',
        userId: USER_ID,
        familyId: FAMILY_ID,
        keyHash: storedHash,
        scope: 'READWRITE',
        name: null,
        createdAt: new Date(),
        revokedAt: null,
        lastUsedAt: null,
      });

      const { plainKey, key } = await service.createKey(USER_ID, 'READWRITE', '我的龙虾');

      expect(plainKey.startsWith('ak_live_')).toBe(true);
      // 24 字节 -> 32 字符 base64url；加上前缀共 40
      expect(plainKey.length).toBe(40);
      expect(key.maskedKey).toContain('ak_live_');
    });

    it('数据库中只存 scrypt 哈希，明文 Key 绝不落库', async () => {
      const storedHash = hashKeyForTest('ak_live_dummytoken0000000000000000');
      prisma.apiKey.create.mockResolvedValue({
        id: 'key-1',
        userId: USER_ID,
        familyId: FAMILY_ID,
        keyHash: storedHash,
        scope: 'READWRITE',
        name: null,
        createdAt: new Date(),
        revokedAt: null,
        lastUsedAt: null,
      });

      const { plainKey } = await service.createKey(USER_ID, 'READWRITE');

      expect(prisma.apiKey.create).toHaveBeenCalledTimes(1);
      const createArg = prisma.apiKey.create.mock.calls[0][0];
      const data = createArg.data as Record<string, any>;

      // 存储的 keyHash 是 salt:hex 形式，绝不等于明文
      expect(data.keyHash).not.toBe(plainKey);
      expect(data.keyHash).toContain(':');
      expect(data.keyHash.split(':')[1]).not.toBe(plainKey);
      // 整条 create 数据里都不应出现明文 Key
      expect(JSON.stringify(createArg)).not.toContain(plainKey);
      // familyId 来自用户家庭，正确冗余写入
      expect(data.familyId).toBe(FAMILY_ID);
    });
  });

  // ============ 校验 ============
  describe('validateKey（校验）', () => {
    const plainKey = 'ak_live_validtoken0000000000000000';
    const validHash = hashKeyForTest(plainKey);

    function candidate(overrides: Partial<any> = {}) {
      return {
        id: 'key-1',
        userId: USER_ID,
        familyId: FAMILY_ID,
        scope: 'READWRITE',
        keyHash: validHash,
        ...overrides,
      };
    }

    it('正确 Key 返回有效 ctx（familyId/userId/scope）', async () => {
      prisma.apiKey.findMany.mockResolvedValue([candidate()]);

      const ctx = await service.validateKey(plainKey);

      expect(ctx).not.toBeNull();
      expect(ctx!.apiKeyId).toBe('key-1');
      expect(ctx!.userId).toBe(USER_ID);
      expect(ctx!.familyId).toBe(FAMILY_ID);
      expect(ctx!.scope).toBe<ApiKeyScope>('READWRITE');
    });

    it('错误 Key 返回 null', async () => {
      prisma.apiKey.findMany.mockResolvedValue([candidate()]);

      const ctx = await service.validateKey('ak_live_wrongkey0000000000000000000');

      expect(ctx).toBeNull();
    });

    it('缺少 Key（undefined / 空串）返回 null', async () => {
      expect(await service.validateKey(undefined)).toBeNull();
      expect(await service.validateKey('')).toBeNull();
      expect(prisma.apiKey.findMany).not.toHaveBeenCalled();
    });

    it('scope 正确解析为 READONLY', async () => {
      prisma.apiKey.findMany.mockResolvedValue([candidate({ scope: 'READONLY' })]);

      const ctx = await service.validateKey(plainKey);

      expect(ctx!.scope).toBe<ApiKeyScope>('READONLY');
    });

    it('scope 正确解析为 READWRITE', async () => {
      prisma.apiKey.findMany.mockResolvedValue([candidate({ scope: 'READWRITE' })]);

      const ctx = await service.validateKey(plainKey);

      expect(ctx!.scope).toBe<ApiKeyScope>('READWRITE');
    });
  });

  // ============ 吊销 ============
  describe('revokeKey（吊销后校验失效）', () => {
    it('吊销后 validateKey 返回 null', async () => {
      const plainKey = 'ak_live_validtoken0000000000000000';
      const validHash = hashKeyForTest(plainKey);

      // 吊销前：findMany 返回该未吊销 Key
      prisma.apiKey.findMany.mockResolvedValue([
        {
          id: 'key-1',
          userId: USER_ID,
          familyId: FAMILY_ID,
          scope: 'READWRITE',
          keyHash: validHash,
        },
      ]);
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        userId: USER_ID,
        revokedAt: null,
      });
      prisma.apiKey.update.mockResolvedValue({ id: 'key-1', revokedAt: new Date() });

      expect(await service.validateKey(plainKey)).not.toBeNull();

      const result = await service.revokeKey(USER_ID, 'key-1');
      expect(result.success).toBe(true);
      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-1' },
        data: { revokedAt: expect.any(Date) },
      });

      // 吊销后：findMany 视为已过滤（revokedAt 非空），返回空
      prisma.apiKey.findMany.mockResolvedValue([]);
      expect(await service.validateKey(plainKey)).toBeNull();
    });

    it('吊销不存在 / 非本人 Key 抛 NotFoundException', async () => {
      prisma.apiKey.findUnique.mockResolvedValue(null);
      await expect(service.revokeKey(USER_ID, 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );

      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-2',
        userId: 'other-user',
        revokedAt: null,
      });
      await expect(service.revokeKey(USER_ID, 'key-2')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  randomBytes,
  scrypt as scryptCb,
  scryptSync,
  timingSafeEqual,
} from 'crypto';
import { promisify } from 'util';
import { PrismaService } from '../../prisma/prisma.service';
import { FamiliesService } from '../families/families.service';

const scrypt = promisify<string, string, number, Buffer>(scryptCb);

/** API Key 作用域 */
export type ApiKeyScope = 'READONLY' | 'READWRITE';

/** 校验通过后注入 MCP 上下文的核心字段 */
export interface McpContextLite {
  apiKeyId: string;
  userId: string;
  familyId: string;
  scope: ApiKeyScope;
}

/** 对外脱敏的 Key 视图（明文永不返回） */
export interface ApiKeyMasked {
  id: string;
  name: string | null;
  scope: ApiKeyScope;
  /** 形如 ak_live_8f3c•••••••• 的展示串，便于用户区分不同 Key */
  maskedKey: string;
  createdAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
}

const KEY_PREFIX = 'ak_live_';
const PLAIN_KEY_BYTES = 24; // 32 字符 base64url
const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;

/**
 * API Key 服务（智能体接入）
 *
 * 安全约定（共享知识 §7）：
 * - 明文 Key 仅在创建时返回一次；库存 scrypt(salt:hash) 拼接哈希。
 * - 校验用 crypto.timingSafeEqual 恒定时间比较，防时序攻击。
 * - revokedAt 非空即视为吊销。
 * - familyId 由 Key 自身携带（冗余存储），校验通过即作为 MCP 上下文的 familyId，
 *   绝不信任客户端传入（越权防护核心）。
 */
@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly familiesService: FamiliesService,
  ) {}

  /**
   * 生成新 API Key。
   * familyId 由用户当前家庭解析（冗余写入 Key，便于隔离校验）。
   * @returns 明文 Key（仅此一次）+ 脱敏记录
   */
  async createKey(
    userId: string,
    scope: ApiKeyScope,
    name?: string | null,
  ): Promise<{ plainKey: string; key: ApiKeyMasked }> {
    // 解析用户当前家庭，作为 Key 归属（同时校验用户确实属于某家庭）
    const family = await this.familiesService.getCurrentFamily(userId);

    const plainKey = KEY_PREFIX + randomBytes(PLAIN_KEY_BYTES).toString('base64url');
    const keyHash = await this.hashKey(plainKey);

    const created = await this.prisma.apiKey.create({
      data: {
        userId,
        familyId: family.id,
        keyHash,
        scope,
        name: name ?? null,
      },
    });

    this.logger.log(
      `API Key 创建: id=${created.id}, userId=${userId}, familyId=${family.id}, scope=${scope}`,
    );

    return { plainKey, key: this.toMasked(created) };
  }

  /** 列出某用户全部 Key（含已吊销；明文永不返回） */
  async listKeys(userId: string): Promise<ApiKeyMasked[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map((k) => this.toMasked(k));
  }

  /**
   * 吊销 Key（硬吊销：置 revokedAt）。仅本人可吊销。
   * 吊销后 QClaw 配置立即失效，需用户重新生成并改 openclaw.json。
   */
  async revokeKey(userId: string, keyId: string): Promise<{ success: boolean }> {
    const key = await this.prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!key || key.userId !== userId) {
      throw new NotFoundException('密钥不存在');
    }
    if (key.revokedAt) {
      return { success: true };
    }
    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });
    this.logger.log(`API Key 吊销: id=${keyId}, userId=${userId}`);
    return { success: true };
  }

  /**
   * 校验明文 Key：
   * 遍历所有未吊销 Key，按各自 salt 重算哈希并恒定时间比较。
   * 命中返回 McpContext 核心字段；未命中返回 null（无效 / 已吊销）。
   */
  async validateKey(plainKey: string | undefined): Promise<McpContextLite | null> {
    if (!plainKey) return null;

    const candidates = await this.prisma.apiKey.findMany({
      where: { revokedAt: null },
      select: {
        id: true,
        userId: true,
        familyId: true,
        scope: true,
        keyHash: true,
      },
    });

    for (const c of candidates) {
      if (c.keyHash && this.verifyKey(plainKey, c.keyHash)) {
        return {
          apiKeyId: c.id,
          userId: c.userId,
          familyId: c.familyId,
          scope: c.scope as ApiKeyScope,
        };
      }
    }
    return null;
  }

  /** 标记最近使用（审计 / 限流辅助；失败静默忽略） */
  async markUsed(apiKeyId: string): Promise<void> {
    await this.prisma.apiKey
      .update({
        where: { id: apiKeyId },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {
        /* 并发或已吊销时忽略 */
      });
  }

  // ==================== 内部方法 ====================

  /** scrypt 生成 salt:hash 拼接串 */
  private async hashKey(key: string): Promise<string> {
    const salt = randomBytes(SCRYPT_SALT_BYTES).toString('hex');
    const derived = await scrypt(key, salt, SCRYPT_KEYLEN);
    return `${salt}:${derived.toString('hex')}`;
  }

  /** 恒定时间比较：从 stored 解析 salt，重算哈希后与期望值比对 */
  private verifyKey(key: string, stored: string): boolean {
    const idx = stored.indexOf(':');
    if (idx <= 0) return false;
    const salt = stored.slice(0, idx);
    const expectedHex = stored.slice(idx + 1);
    let derived: Buffer;
    try {
      derived = scryptSync(key, salt, SCRYPT_KEYLEN);
    } catch {
      return false;
    }
    const expected = Buffer.from(expectedHex, 'hex');
    if (expected.length !== derived.length) return false;
    return timingSafeEqual(expected, derived);
  }

  private toMasked(k: {
    id: string;
    name: string | null;
    scope: ApiKeyScope;
    createdAt: Date;
    revokedAt: Date | null;
    lastUsedAt: Date | null;
  }): ApiKeyMasked {
    return {
      id: k.id,
      name: k.name,
      scope: k.scope,
      maskedKey: `${KEY_PREFIX}${k.id.slice(0, 4)}••••••••`,
      createdAt: k.createdAt,
      revokedAt: k.revokedAt,
      lastUsedAt: k.lastUsedAt,
    };
  }
}

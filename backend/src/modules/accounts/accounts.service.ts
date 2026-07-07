import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FamiliesService } from '../families/families.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

/**
 * 序列化账户：将 Prisma Decimal 金额字段转为 number，方便前端消费。
 * 金额统一在前端以 toFixed(2) 展示。
 */
function serializeAccount(account: any) {
  return {
    ...account,
    balance: account.balance != null ? Number(account.balance) : null,
    creditLimit: account.creditLimit != null ? Number(account.creditLimit) : null,
    availableCredit: account.availableCredit != null ? Number(account.availableCredit) : null,
  };
}

/**
 * 账户服务
 * 核心：账户 CRUD、按 familyId 隔离、信用卡可用额度计算、停用翻转
 */
@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly familiesService: FamiliesService,
  ) {}

  /**
   * 创建账户
   * 1. 校验当前用户属于目标家庭（family 隔离）
   * 2. 信用卡类型计算 availableCredit = creditLimit - balance（决策#2）
   */
  async createAccount(user: AuthenticatedUser, dto: CreateAccountDto) {
    // 家庭维度隔离校验
    await this.familiesService.validateFamilyMember(dto.familyId, user.userId);

    // 若指定了账本，校验账本属于该家庭（决策#4：账本可空）
    if (dto.ledgerId) {
      const ledger = await this.prisma.ledger.findUnique({
        where: { id: dto.ledgerId },
        select: { familyId: true },
      });
      if (!ledger) {
        throw new NotFoundException('账本不存在');
      }
      if (ledger.familyId !== dto.familyId) {
        throw new BadRequestException('账本不属于该家庭');
      }
    }

    // 信用卡：可用额度 = 授信额度 - 当前欠款
    const availableCredit =
      dto.type === 'CREDIT' && dto.creditLimit != null
        ? dto.creditLimit - dto.balance
        : null;

    const account = await this.prisma.account.create({
      data: {
        familyId: dto.familyId,
        ledgerId: dto.ledgerId ?? null,
        userId: user.userId,
        type: dto.type,
        name: dto.name,
        balance: dto.balance,
        institution: dto.institution ?? null,
        lastFourDigits: dto.lastFourDigits ?? null,
        creditLimit: dto.creditLimit ?? null,
        billingDay: dto.billingDay ?? null,
        paymentDueDay: dto.paymentDueDay ?? null,
        availableCredit,
        platform: dto.platform ?? null,
        purpose: dto.purpose ?? null,
        currency: dto.currency ?? 'CNY',
        isActive: true,
      },
    });

    this.logger.log(`账户创建成功: id=${account.id}, type=${dto.type}, family=${dto.familyId}`);
    return serializeAccount(account);
  }

  /**
   * 获取家庭下的账户列表（按类型、创建时间排序）
   */
  async getAccounts(familyId: string, user: AuthenticatedUser) {
    await this.familiesService.validateFamilyMember(familyId, user.userId);

    const accounts = await this.prisma.account.findMany({
      where: { familyId },
      orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
    });

    return accounts.map(serializeAccount);
  }

  /**
   * 账户详情
   */
  async getAccountById(id: string, user: AuthenticatedUser) {
    const account = await this.prisma.account.findUnique({ where: { id } });
    if (!account) {
      throw new NotFoundException('账户不存在');
    }
    // 隔离：确认用户属于该账户所在家庭
    await this.familiesService.validateFamilyMember(account.familyId, user.userId);
    return serializeAccount(account);
  }

  /**
   * 更新账户
   * 信用卡且提供了 creditLimit 或 balance 时重算 availableCredit
   */
  async updateAccount(id: string, user: AuthenticatedUser, dto: UpdateAccountDto) {
    const existing = await this.prisma.account.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('账户不存在');
    }
    await this.familiesService.validateFamilyMember(existing.familyId, user.userId);

    // 构造更新数据（仅包含传入字段）
    const data: Prisma.AccountUpdateInput = {};
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.balance !== undefined) data.balance = dto.balance;
    if (dto.institution !== undefined) data.institution = dto.institution;
    if (dto.lastFourDigits !== undefined) data.lastFourDigits = dto.lastFourDigits;
    if (dto.creditLimit !== undefined) data.creditLimit = dto.creditLimit;
    if (dto.billingDay !== undefined) data.billingDay = dto.billingDay;
    if (dto.paymentDueDay !== undefined) data.paymentDueDay = dto.paymentDueDay;
    if (dto.platform !== undefined) data.platform = dto.platform;
    if (dto.purpose !== undefined) data.purpose = dto.purpose;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.ledgerId !== undefined) data.ledgerId = dto.ledgerId;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    // 信用卡可用额度重算：以新值（缺失则取原值）计算
    const type = dto.type ?? existing.type;
    if (type === 'CREDIT') {
      const creditLimitRaw = dto.creditLimit !== undefined ? dto.creditLimit : existing.creditLimit;
      const balanceRaw = dto.balance !== undefined ? dto.balance : existing.balance;
      // 两者任一存在才计算可用额度，避免误清空（Decimal 需转 Number 再做运算）
      if (creditLimitRaw != null && balanceRaw != null) {
        data.availableCredit = Number(creditLimitRaw) - Number(balanceRaw);
      }
    }

    const account = await this.prisma.account.update({ where: { id }, data });
    this.logger.log(`账户更新成功: id=${id}`);
    return serializeAccount(account);
  }

  /**
   * 停用 / 启用账户（翻转 isActive，不删除，决策#3）
   */
  async deactivateAccount(id: string, user: AuthenticatedUser) {
    const existing = await this.prisma.account.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('账户不存在');
    }
    await this.familiesService.validateFamilyMember(existing.familyId, user.userId);

    const account = await this.prisma.account.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    this.logger.log(`账户${account.isActive ? '启用' : '停用'}: id=${id}`);
    return serializeAccount(account);
  }
}

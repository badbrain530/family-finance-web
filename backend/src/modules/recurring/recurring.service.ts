import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { FamiliesService } from '../families/families.service';
import { LedgersService } from '../ledgers/ledgers.service';
import { TransactionsService } from '../transactions/transactions.service';
import {
  CreateRecurringRuleDto,
  UpdateRecurringRuleDto,
  GenerateRecurringDto,
} from './dto/create-recurring-rule.dto';
import { CreateTransactionDto } from '../transactions/dto/create-transaction.dto';
import dayjs from 'dayjs';

/**
 * 周期记账服务
 * 规则 CRUD + 按 nextRunAt 游标手动/自动生成交易（幂等）。
 * 预留后端 @Cron 自动生成（由环境变量 RECURRING_CRON_ENABLED 守护，默认关闭，方案 A）。
 */
@Injectable()
export class RecurringService {
  private readonly logger = new Logger(RecurringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly familiesService: FamiliesService,
    private readonly ledgersService: LedgersService,
    private readonly transactionsService: TransactionsService,
  ) {}

  // ==================== 游标计算 ====================

  /** 将起始日按频率/星期/日期约束对齐到首个应生成日 */
  private computeInitialNextRunAt(dto: {
    startDate: Date;
    frequency: string;
    weekday?: number | null;
    monthDay?: number | null;
  }): Date {
    let d = dayjs(dto.startDate);
    if (dto.frequency === 'WEEKLY' && dto.weekday) {
      // 推进到指定的星期几（1-7，周日=7）
      const target = dto.weekday % 7; // dayjs: 0=周日
      let diff = (target - d.day()) % 7;
      if (diff < 0) diff += 7;
      d = d.add(diff, 'day');
    } else if (dto.frequency === 'MONTHLY' && dto.monthDay) {
      const day = Math.min(dto.monthDay, d.daysInMonth());
      if (day < d.date()) {
        d = d.add(1, 'month');
      }
      d = d.date(Math.min(dto.monthDay, d.daysInMonth()));
    }
    return d.toDate();
  }

  /** 将游标推进一个周期（interval 个频率单位） */
  private advance(date: Date, frequency: string, interval: number): Date {
    const d = dayjs(date);
    switch (frequency) {
      case 'DAILY':
        return d.add(interval, 'day').toDate();
      case 'WEEKLY':
        return d.add(interval * 7, 'day').toDate();
      case 'MONTHLY':
        return d.add(interval, 'month').toDate();
      case 'YEARLY':
        return d.add(interval, 'year').toDate();
      default:
        return d.add(interval, 'month').toDate();
    }
  }

  // ==================== CRUD ====================

  async createRule(userId: string, dto: CreateRecurringRuleDto) {
    const ledger = await this.ledgersService.getLedger(dto.ledgerId, userId);
    const nextRunAt = this.computeInitialNextRunAt({
      startDate: new Date(dto.startDate),
      frequency: dto.frequency,
      weekday: dto.weekday,
      monthDay: dto.monthDay,
    });

    const rule = await this.prisma.recurringRule.create({
      data: {
        familyId: ledger.familyId,
        ledgerId: dto.ledgerId,
        userId,
        categoryId: dto.categoryId || null,
        accountId: dto.accountId || null,
        type: dto.type.toUpperCase() as 'INCOME' | 'EXPENSE',
        amount: dto.amount,
        merchant: dto.merchant || null,
        note: dto.note || null,
        frequency: dto.frequency,
        interval: dto.interval || 1,
        weekday: dto.weekday ?? null,
        monthDay: dto.monthDay ?? null,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        nextRunAt,
        isActive: true,
      },
    });

    this.logger.log(`周期规则创建: id=${rule.id}, type=${dto.type}, freq=${dto.frequency}, by=${userId}`);
    return rule;
  }

  async listRules(userId: string, familyId: string) {
    await this.familiesService.validateFamilyMember(familyId, userId);
    return this.prisma.recurringRule.findMany({
      where: { familyId },
      orderBy: { nextRunAt: 'asc' },
    });
  }

  async getRule(userId: string, id: string) {
    const rule = await this.prisma.recurringRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('周期规则不存在');
    await this.familiesService.validateFamilyMember(rule.familyId, userId);
    return rule;
  }

  async updateRule(userId: string, id: string, dto: UpdateRecurringRuleDto) {
    const existing = await this.getRule(userId, id);
    const familyId = (await this.ledgersService.getLedger(
      dto.ledgerId || existing.ledgerId,
      userId,
    )).familyId;
    if (familyId !== existing.familyId) {
      throw new BadRequestException('不能跨家庭修改规则');
    }

    const frequency = dto.frequency ?? existing.frequency;
    const weekday = dto.weekday !== undefined ? dto.weekday : existing.weekday;
    const monthDay = dto.monthDay !== undefined ? dto.monthDay : existing.monthDay;

    // 频率/约束变化导致游标需重算（仅当规则尚无生成历史时）
    let nextRunAt = existing.nextRunAt;
    if (
      (dto.frequency || dto.weekday !== undefined || dto.monthDay !== undefined) &&
      dto.startDate === undefined
    ) {
      nextRunAt = this.computeInitialNextRunAt({
        startDate: existing.nextRunAt,
        frequency,
        weekday,
        monthDay,
      });
    }

    const updated = await this.prisma.recurringRule.update({
      where: { id },
      data: {
        ledgerId: dto.ledgerId ?? existing.ledgerId,
        categoryId: dto.categoryId !== undefined ? dto.categoryId : existing.categoryId,
        accountId: dto.accountId !== undefined ? dto.accountId : existing.accountId,
        type: dto.type ? (dto.type.toUpperCase() as 'INCOME' | 'EXPENSE') : existing.type,
        amount: dto.amount ?? existing.amount,
        merchant: dto.merchant !== undefined ? dto.merchant : existing.merchant,
        note: dto.note !== undefined ? dto.note : existing.note,
        frequency,
        interval: dto.interval ?? existing.interval,
        weekday,
        monthDay,
        startDate: dto.startDate ? new Date(dto.startDate) : existing.startDate,
        endDate: dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : existing.endDate,
        nextRunAt: dto.startDate ? this.computeInitialNextRunAt({
          startDate: new Date(dto.startDate),
          frequency,
          weekday,
          monthDay,
        }) : nextRunAt,
        isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      },
    });
    return updated;
  }

  async deleteRule(userId: string, id: string) {
    await this.getRule(userId, id);
    await this.prisma.recurringRule.delete({ where: { id } });
    return { success: true };
  }

  // ==================== 生成 ====================

  /** 手动补生成：nextRunAt<=before 且 isActive 的规则逐条生成并推进游标（幂等） */
  async generate(userId: string, dto: GenerateRecurringDto) {
    await this.familiesService.validateFamilyMember(dto.familyId, userId);
    const limit = dto.before ? new Date(dto.before) : new Date();

    const rules = await this.prisma.recurringRule.findMany({
      where: {
        familyId: dto.familyId,
        isActive: true,
        nextRunAt: { lte: limit },
      },
    });

    let total = 0;
    const generatedRules: string[] = [];
    for (const rule of rules) {
      const count = await this.generateRuleOccurrences(rule, limit, userId);
      if (count > 0) {
        total += count;
        generatedRules.push(rule.id);
      }
    }

    this.logger.log(`周期生成: family=${dto.familyId}, total=${total}, rules=${generatedRules.length}, by=${userId}`);
    return { generated: total, rules: generatedRules };
  }

  /** 单规则立即生成到期项 */
  async generateOne(userId: string, id: string) {
    const rule = await this.getRule(userId, id);
    const limit = new Date();
    const count = await this.generateRuleOccurrences(rule, limit, userId);
    return { generated: count };
  }

  /** 内部：为单条规则生成所有到期未生成的交易并推进 nextRunAt */
  private async generateRuleOccurrences(
    rule: any,
    limit: Date,
    userId: string,
  ): Promise<number> {
    let cursor = new Date(rule.nextRunAt);
    let count = 0;
    // 防御：避免死循环（最多 termMonths*? 兜底 1000 次）
    const maxIter = 1000;

    while (cursor <= limit && count < maxIter) {
      if (rule.endDate && cursor > new Date(rule.endDate)) break;

      const createDto: CreateTransactionDto = {
        ledgerId: rule.ledgerId,
        categoryId: rule.categoryId,
        accountId: rule.accountId ?? null,
        type: rule.type.toLowerCase() as 'income' | 'expense',
        amount: Number(rule.amount),
        date: cursor.toISOString(),
        merchant: rule.merchant || null,
        note: rule.note || null,
        source: 'manual',
      } as CreateTransactionDto;

      await this.transactionsService.createTransaction(userId, createDto);
      count++;
      cursor = this.advance(cursor, rule.frequency, rule.interval || 1);
    }

    // 仅当确实推进时回写游标，保证幂等（下次不会重复生成）
    if (count > 0) {
      await this.prisma.recurringRule.update({
        where: { id: rule.id },
        data: { nextRunAt: cursor },
      });
    }
    return count;
  }

  // ==================== 预留：后端定时自动生成（方案 A） ====================
  // 默认关闭；设置环境变量 RECURRING_CRON_ENABLED=true 后由后端常驻定时扫描生成。
  // 注意：并发场景需加锁（P0 手动触发并发低，未加锁）。
  @Cron('0 2 * * *', { disabled: !(process.env.RECURRING_CRON_ENABLED === 'true') })
  async handleCronGenerate() {
    if (process.env.RECURRING_CRON_ENABLED !== 'true') return;
    this.logger.log('周期自动生成(cron)触发');
    const rules = await this.prisma.recurringRule.findMany({
      where: { isActive: true, nextRunAt: { lte: new Date() } },
      select: { familyId: true },
      distinct: ['familyId'],
    });
    for (const { familyId } of rules) {
      try {
        await this.generate({ familyId } as any, { familyId } as GenerateRecurringDto);
      } catch (err) {
        this.logger.warn(`cron 生成失败 family=${familyId}: ${err}`);
      }
    }
  }
}

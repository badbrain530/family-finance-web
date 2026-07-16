import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { FamiliesService } from '../families/families.service';
import { LedgersService } from '../ledgers/ledgers.service';
import { TransactionsService } from '../transactions/transactions.service';
import {
  CreateBondDto,
  UpdateBondDto,
  GenerateBondDto,
} from './dto/create-bond.dto';
import { CreateTransactionDto } from '../transactions/dto/create-transaction.dto';

/** 四舍五入保留2位 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface BondScheduleRow {
  seq: number;
  dueDate: Date;
  coupon: number;
  principalReturn: number;
  remainingPrincipal: number;
}

type CouponFrequency = 'MONTHLY' | 'QUARTERLY' | 'SEMI' | 'ANNUAL';

/**
 * 债券服务（仅 HELD 持有方）
 * 创建即算完整票息计划（bullet 固定票息）；generate 为到期 pending 计划生成票息 INCOME，
 * 末期额外生成本金返还 INCOME。
 */
@Injectable()
export class BondsService {
  private readonly logger = new Logger(BondsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly familiesService: FamiliesService,
    private readonly ledgersService: LedgersService,
    private readonly transactionsService: TransactionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ==================== 算法（bullet 固定票息） ====================

  /**
   * 计算完整票息计划。
   * 总付息期数 = round(termMonths / 每期月数)；每期票息 = 面值 × 年利率 / 每年期数。
   * 仅末期 principalReturn = 面值、remainingPrincipal = 0；其余为 0 / 面值。
   */
  private computeBondSchedule(dto: {
    faceValue: number;
    annualRate: number;
    termMonths: number;
    couponFrequency: CouponFrequency;
    startDate: Date;
  }): BondScheduleRow[] {
    const FV = dto.faceValue;
    const annualRatePct = dto.annualRate; // 如 4.2 表示 4.2%

    const freqMap: Record<CouponFrequency, { monthsPerPeriod: number; periodsPerYear: number }> = {
      MONTHLY: { monthsPerPeriod: 1, periodsPerYear: 12 },
      QUARTERLY: { monthsPerPeriod: 3, periodsPerYear: 4 },
      SEMI: { monthsPerPeriod: 6, periodsPerYear: 2 },
      ANNUAL: { monthsPerPeriod: 12, periodsPerYear: 1 },
    };
    const { monthsPerPeriod, periodsPerYear } = freqMap[dto.couponFrequency];
    const periods = Math.max(1, Math.round(dto.termMonths / monthsPerPeriod));
    const periodCoupon = round2((FV * (annualRatePct / 100)) / periodsPerYear);

    const dueDates: Date[] = [];
    for (let i = 0; i < periods; i++) {
      const d = new Date(dto.startDate);
      d.setMonth(d.getMonth() + (i + 1) * monthsPerPeriod);
      dueDates.push(d);
    }

    const rows: BondScheduleRow[] = [];
    for (let i = 0; i < periods; i++) {
      const isLast = i === periods - 1;
      rows.push({
        seq: i + 1,
        dueDate: dueDates[i],
        coupon: round2(periodCoupon),
        principalReturn: round2(isLast ? FV : 0),
        remainingPrincipal: round2(isLast ? 0 : FV),
      });
    }
    return rows;
  }

  // ==================== CRUD ====================

  async createBond(userId: string, dto: CreateBondDto) {
    const ledger = await this.ledgersService.getLedger(dto.ledgerId, userId);
    const schedule = this.computeBondSchedule({
      faceValue: dto.faceValue,
      annualRate: dto.annualRate,
      termMonths: dto.termMonths,
      couponFrequency: dto.couponFrequency,
      startDate: new Date(dto.startDate),
    });

    const bond = await this.prisma.bond.create({
      data: {
        familyId: ledger.familyId,
        ledgerId: dto.ledgerId,
        accountId: dto.accountId || null,
        name: dto.name,
        faceValue: dto.faceValue,
        annualRate: dto.annualRate,
        termMonths: dto.termMonths,
        method: dto.method,
        couponFrequency: dto.couponFrequency,
        startDate: new Date(dto.startDate),
        categoryId: dto.categoryId || null,
      },
    });

    await this.prisma.bondSchedule.createMany({
      data: schedule.map((s) => ({
        bondId: bond.id,
        seq: s.seq,
        dueDate: s.dueDate,
        coupon: s.coupon,
        principalReturn: s.principalReturn,
        remainingPrincipal: s.remainingPrincipal,
        status: 'pending',
      })),
    });

    this.logger.log(`债券创建: id=${bond.id}, name=${dto.name}, by=${userId}`);
    return this.getBond(bond.id, userId);
  }

  async listBonds(userId: string, familyId: string) {
    await this.familiesService.validateFamilyMember(familyId, userId);
    return this.prisma.bond.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
      include: { schedules: { orderBy: { seq: 'asc' } } },
    });
  }

  async getBond(id: string, userId: string) {
    const bond = await this.prisma.bond.findUnique({
      where: { id },
      include: { schedules: { orderBy: { seq: 'asc' } } },
    });
    if (!bond) throw new NotFoundException('债券不存在');
    await this.familiesService.validateFamilyMember(bond.familyId, userId);
    return bond;
  }

  async updateBond(id: string, userId: string, dto: UpdateBondDto) {
    const existing = await this.getBond(id, userId);

    const familyId = (await this.ledgersService.getLedger(
      dto.ledgerId || existing.ledgerId,
      userId,
    )).familyId;
    if (familyId !== existing.familyId) {
      throw new BadRequestException('不能跨家庭修改债券');
    }

    // 仅允许在未生成交易前重算计划
    const generated = await this.prisma.bondSchedule.count({
      where: { bondId: id, status: 'paid' },
    });
    if (generated > 0) {
      throw new BadRequestException('已生成票息交易的债券不可修改计划参数');
    }

    const faceValue = dto.faceValue ?? Number(existing.faceValue);
    const annualRate = dto.annualRate ?? Number(existing.annualRate);
    const termMonths = dto.termMonths ?? existing.termMonths;
    const method = dto.method ?? existing.method;
    const couponFrequency = dto.couponFrequency ?? existing.couponFrequency;
    const startDate = dto.startDate ? new Date(dto.startDate) : existing.startDate;

    const schedule = this.computeBondSchedule({
      faceValue,
      annualRate,
      termMonths,
      couponFrequency,
      startDate,
    });

    await this.prisma.$transaction([
      this.prisma.bond.update({
        where: { id },
        data: {
          ledgerId: dto.ledgerId ?? existing.ledgerId,
          accountId: dto.accountId !== undefined ? dto.accountId : existing.accountId,
          name: dto.name ?? existing.name,
          faceValue,
          annualRate,
          termMonths,
          method,
          couponFrequency,
          startDate,
          categoryId: dto.categoryId !== undefined ? dto.categoryId : existing.categoryId,
        },
      }),
      this.prisma.bondSchedule.deleteMany({ where: { bondId: id } }),
      this.prisma.bondSchedule.createMany({
        data: schedule.map((s) => ({
          bondId: id,
          seq: s.seq,
          dueDate: s.dueDate,
          coupon: s.coupon,
          principalReturn: s.principalReturn,
          remainingPrincipal: s.remainingPrincipal,
          status: 'pending',
        })),
      }),
    ]);

    return this.getBond(id, userId);
  }

  async deleteBond(id: string, userId: string) {
    const existing = await this.getBond(id, userId);
    await this.prisma.$transaction([
      this.prisma.bondSchedule.deleteMany({ where: { bondId: id } }),
      this.prisma.bond.delete({ where: { id } }),
    ]);
    return { success: true };
  }

  // ==================== 生成票息交易 ====================

  /**
   * 为到期（dueDate<=upto）的 pending 计划生成票息 INCOME；末期额外生成本金返还 INCOME。
   * 幂等：已 paid 的计划不重复生成。
   */
  async generatePayments(id: string, userId: string, dto: GenerateBondDto) {
    const bond = await this.getBond(id, userId);
    const upto = dto.upto ? new Date(dto.upto) : new Date();

    const pending = await this.prisma.bondSchedule.findMany({
      where: { bondId: id, status: 'pending', dueDate: { lte: upto } },
      orderBy: { seq: 'asc' },
    });

    const lastSeq = Math.max(...bond.schedules.map((s) => s.seq));

    let generated = 0;
    for (const s of pending) {
      const couponTx = await this.createCouponTransaction(bond, s, userId);
      const updateData: {
        status: string;
        generatedTxId: string;
        generatedInterestTxId?: string;
      } = { status: 'paid', generatedTxId: couponTx.id };

      if (s.seq === lastSeq && Number(s.principalReturn) > 0) {
        const principalTx = await this.createPrincipalReturnTransaction(bond, s, userId);
        updateData.generatedInterestTxId = principalTx.id;
      }

      await this.prisma.bondSchedule.update({ where: { id: s.id }, data: updateData });
      generated++;
    }

    this.logger.log(`债券生成票息: bond=${id}, generated=${generated}, by=${userId}`);
    return { generated };
  }

  private async createCouponTransaction(bond: any, schedule: any, userId: string) {
    return this.transactionsService.createTransaction(userId, {
      ledgerId: bond.ledgerId,
      accountId: bond.accountId ?? null,
      type: 'income',
      amount: schedule.coupon,
      date: schedule.dueDate.toISOString(),
      merchant: bond.name,
      note: `第${schedule.seq}期票息（${bond.name}）`,
      source: 'manual',
      metadata: { kind: 'bond_coupon', bondId: bond.id, scheduleSeq: schedule.seq },
    } as CreateTransactionDto);
  }

  private async createPrincipalReturnTransaction(bond: any, schedule: any, userId: string) {
    return this.transactionsService.createTransaction(userId, {
      ledgerId: bond.ledgerId,
      accountId: bond.accountId ?? null,
      type: 'income',
      amount: schedule.principalReturn,
      date: schedule.dueDate.toISOString(),
      merchant: bond.name,
      note: `第${schedule.seq}期本金返还（${bond.name}）`,
      source: 'manual',
      metadata: { kind: 'bond_principal_return', bondId: bond.id, scheduleSeq: schedule.seq },
    } as CreateTransactionDto);
  }
}

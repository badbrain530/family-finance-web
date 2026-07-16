import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { FamiliesService } from '../families/families.service';
import { LedgersService } from '../ledgers/ledgers.service';
import { TransactionsService } from '../transactions/transactions.service';
import {
  CreateAmortizationDto,
  UpdateAmortizationDto,
  GenerateAmortizationDto,
} from './dto/create-amortization.dto';
import { CreateTransactionDto } from '../transactions/dto/create-transaction.dto';

/** 四舍五入保留2位 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface AmortRow {
  seq: number;
  dueDate: Date;
  amount: number;
}

/**
 * 待摊/预付服务
 * - createItem：初始入账一笔 EXPENSE（无 amortizationItemId，计入净支出）+ 算全表。
 * - generate：每期生成摊销 EXPENSE（带 amortizationItemId，Net Expense 排除）+ 递减 remaining。
 */
@Injectable()
export class AmortizationService {
  private readonly logger = new Logger(AmortizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly familiesService: FamiliesService,
    private readonly ledgersService: LedgersService,
    private readonly transactionsService: TransactionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ==================== 算法 ====================

  private computeAmortizationSchedule(dto: {
    totalAmount: number;
    periodMonths: number;
    startDate: Date;
  }): AmortRow[] {
    const total = dto.totalAmount;
    const n = dto.periodMonths;
    const per = round2(total / n);

    const dueDates: Date[] = [];
    for (let i = 1; i <= n; i++) {
      const d = new Date(dto.startDate);
      d.setMonth(d.getMonth() + i);
      dueDates.push(d);
    }

    const rows: AmortRow[] = [];
    for (let i = 0; i < n; i++) {
      const isLast = i === n - 1;
      // 末期校正：使 N 期总额精确等于 totalAmount
      const amount = isLast ? round2(total - per * (n - 1)) : per;
      rows.push({ seq: i + 1, dueDate: dueDates[i], amount: round2(amount) });
    }
    return rows;
  }

  // ==================== CRUD ====================

  async createItem(userId: string, dto: CreateAmortizationDto) {
    const ledger = await this.ledgersService.getLedger(dto.ledgerId, userId);

    // 1) 先创建摊销项（拿 id），初始 remaining = total
    const item = await this.prisma.amortizationItem.create({
      data: {
        familyId: ledger.familyId,
        ledgerId: dto.ledgerId,
        accountId: dto.accountId || null,
        name: dto.name,
        totalAmount: dto.totalAmount,
        amortizedAmount: 0,
        remainingAmount: dto.totalAmount,
        startDate: new Date(dto.startDate),
        periodMonths: dto.periodMonths,
        periodType: 'MONTHLY',
        type: dto.type,
        categoryId: dto.categoryId || null,
        note: dto.note || null,
        isActive: true,
      },
    });

    // 2) 初始入账 EXPENSE（无 amortizationItemId，计入净支出）
    const sourceTx = await this.transactionsService.createTransaction(userId, {
      ledgerId: dto.ledgerId,
      accountId: dto.accountId || null,
      categoryId: dto.categoryId || null,
      type: 'expense',
      amount: dto.totalAmount,
      date: new Date(dto.startDate).toISOString(),
        merchant: undefined,
        note: `待摊/预付初始入账:${dto.name}`,
        source: 'manual',
        metadata: { kind: 'amortization_initial', itemId: item.id },
    } as CreateTransactionDto);

    // 3) 回填 sourceTxId
    await this.prisma.amortizationItem.update({
      where: { id: item.id },
      data: { sourceTxId: sourceTx.id },
    });

    // 4) 算全表
    const schedule = this.computeAmortizationSchedule({
      totalAmount: dto.totalAmount,
      periodMonths: dto.periodMonths,
      startDate: new Date(dto.startDate),
    });
    await this.prisma.amortizationSchedule.createMany({
      data: schedule.map((s) => ({
        itemId: item.id,
        seq: s.seq,
        dueDate: s.dueDate,
        amount: s.amount,
        status: 'pending',
      })),
    });

    this.logger.log(`待摊/预付创建: item=${item.id}, name=${dto.name}, type=${dto.type}, by=${userId}`);
    return this.getItem(item.id, userId);
  }

  async listItems(userId: string, familyId: string) {
    await this.familiesService.validateFamilyMember(familyId, userId);
    return this.prisma.amortizationItem.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
      include: { schedules: { orderBy: { seq: 'asc' } } },
    });
  }

  async getItem(id: string, userId: string) {
    const item = await this.prisma.amortizationItem.findUnique({
      where: { id },
      include: { schedules: { orderBy: { seq: 'asc' } } },
    });
    if (!item) throw new NotFoundException('待摊/预付项不存在');
    await this.familiesService.validateFamilyMember(item.familyId, userId);
    return item;
  }

  async updateItem(id: string, userId: string, dto: UpdateAmortizationDto) {
    const existing = await this.getItem(id, userId);
    const generated = await this.prisma.amortizationSchedule.count({
      where: { itemId: id, status: 'posted' },
    });
    if (generated > 0) {
      throw new BadRequestException('已生成摊销交易的项不可修改参数');
    }

    const totalAmount = dto.totalAmount ?? Number(existing.totalAmount);
    const periodMonths = dto.periodMonths ?? existing.periodMonths;
    const startDate = dto.startDate ? new Date(dto.startDate) : existing.startDate;

    const schedule = this.computeAmortizationSchedule({
      totalAmount,
      periodMonths,
      startDate,
    });

    await this.prisma.$transaction([
      this.prisma.amortizationItem.update({
        where: { id },
        data: {
          ledgerId: dto.ledgerId ?? existing.ledgerId,
          accountId: dto.accountId !== undefined ? dto.accountId : existing.accountId,
          name: dto.name ?? existing.name,
          totalAmount,
          remainingAmount: totalAmount,
          amortizedAmount: 0,
          startDate,
          periodMonths,
          type: dto.type ?? existing.type,
          categoryId: dto.categoryId !== undefined ? dto.categoryId : existing.categoryId,
          note: dto.note !== undefined ? dto.note : existing.note,
          isActive: true,
        },
      }),
      this.prisma.amortizationSchedule.deleteMany({ where: { itemId: id } }),
      this.prisma.amortizationSchedule.createMany({
        data: schedule.map((s) => ({
          itemId: id,
          seq: s.seq,
          dueDate: s.dueDate,
          amount: s.amount,
          status: 'pending',
        })),
      }),
    ]);

    return this.getItem(id, userId);
  }

  async deleteItem(id: string, userId: string) {
    const existing = await this.getItem(id, userId);
    await this.prisma.$transaction([
      this.prisma.amortizationSchedule.deleteMany({ where: { itemId: id } }),
      this.prisma.amortizationItem.delete({ where: { id } }),
    ]);
    return { success: true };
  }

  // ==================== 生成摊销交易 ====================

  /**
   * 为到期（dueDate<=upto）的 pending 计划生成摊销 EXPENSE（带 amortizationItemId，Net Expense 排除），
   * 并递减 item 的 remainingAmount（末期归零 → isActive=false）。幂等。
   */
  async generate(id: string, userId: string, dto: GenerateAmortizationDto) {
    const item = await this.getItem(id, userId);
    const upto = dto.upto ? new Date(dto.upto) : new Date();

    const pending = await this.prisma.amortizationSchedule.findMany({
      where: { itemId: id, status: 'pending', dueDate: { lte: upto } },
      orderBy: { seq: 'asc' },
    });

    let totalGenerated = 0;
    for (const s of pending) {
      const tx = await this.transactionsService.createTransaction(userId, {
        ledgerId: item.ledgerId,
        accountId: item.accountId ?? null,
        categoryId: item.categoryId || null,
        type: 'expense',
        amount: Number(s.amount),
        date: s.dueDate.toISOString(),
        merchant: undefined,
        note: `第${s.seq}期摊销:${item.name}`,
        source: 'manual',
        amortizationItemId: item.id,
        metadata: { kind: 'amortization', itemId: item.id, scheduleSeq: s.seq },
      } as CreateTransactionDto);

      await this.prisma.amortizationSchedule.update({
        where: { id: s.id },
        data: { status: 'posted', generatedTxId: tx.id },
      });
      totalGenerated = round2(totalGenerated + Number(s.amount));
    }

    // 更新 item 余额（末期归零）
    const newRemaining = round2(Number(item.remainingAmount) - totalGenerated);
    const isFinal = newRemaining <= 0.005;
    await this.prisma.amortizationItem.update({
      where: { id },
      data: {
        amortizedAmount: round2(Number(item.amortizedAmount) + totalGenerated),
        remainingAmount: isFinal ? 0 : newRemaining,
        isActive: !isFinal,
      },
    });

    this.logger.log(`待摊/预付生成: item=${id}, generated=${pending.length}, by=${userId}`);
    return { generated: pending.length };
  }
}

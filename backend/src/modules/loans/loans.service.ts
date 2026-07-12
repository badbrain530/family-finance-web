import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { FamiliesService } from '../families/families.service';
import { LedgersService } from '../ledgers/ledgers.service';
import { TransactionsService } from '../transactions/transactions.service';
import {
  CreateLoanDto,
  UpdateLoanDto,
  GenerateLoanDto,
} from './dto/create-loan.dto';
import { CreateTransactionDto } from '../transactions/dto/create-transaction.dto';

/** 四舍五入保留2位 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface ScheduleRow {
  seq: number;
  dueDate: Date;
  payment: number;
  principalPart: number;
  interestPart: number;
  remainingPrincipal: number;
}

/**
 * 贷款服务
 * 等额本息 / 等额本金算法生成完整 LoanSchedule；为到期 pending 计划生成单笔还款 EXPENSE 交易。
 */
@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly familiesService: FamiliesService,
    private readonly ledgersService: LedgersService,
    private readonly transactionsService: TransactionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ==================== 算法 ====================

  /**
   * 计算完整还款计划
   * @returns 每期明细（principalPart/interestPart/payment/remainingPrincipal）
   */
  private computeSchedule(dto: {
    principal: number;
    annualRate: number;
    termMonths: number;
    method: 'EQUAL_INSTALLMENT' | 'EQUAL_PRINCIPAL';
    startDate: Date;
  }): ScheduleRow[] {
    const P = dto.principal;
    const n = dto.termMonths;
    const r = dto.annualRate / 100 / 12; // 月利率
    const rows: ScheduleRow[] = [];

    // 每期还款日：从 startDate 起按月递增
    const dueDates: Date[] = [];
    for (let i = 0; i < n; i++) {
      const d = new Date(dto.startDate);
      d.setMonth(d.getMonth() + i);
      dueDates.push(d);
    }

    if (dto.method === 'EQUAL_INSTALLMENT') {
      // 等额本息：M = P·r·(1+r)^n / ((1+r)^n − 1)
      let monthly: number;
      if (r === 0) {
        monthly = P / n;
      } else {
        const pow = Math.pow(1 + r, n);
        monthly = (P * r * pow) / (pow - 1);
      }
      let remaining = P;
      for (let i = 0; i < n; i++) {
        const interest = remaining * r;
        let principalPart = monthly - interest;
        // 末期校正：使本息和精确等于剩余本金
        if (i === n - 1) {
          principalPart = remaining;
        }
        remaining = round2(remaining - principalPart);
        const payment = round2(principalPart + interest);
        rows.push({
          seq: i + 1,
          dueDate: dueDates[i],
          payment,
          principalPart: round2(principalPart),
          interestPart: round2(interest),
          remainingPrincipal: round2(remaining),
        });
      }
    } else {
      // 等额本金：每期本金 = P/n；利息 = 剩余本金·r；月供递减
      const principalPart = P / n;
      let remaining = P;
      for (let i = 0; i < n; i++) {
        const interest = remaining * r;
        let pPart = principalPart;
        if (i === n - 1) {
          pPart = remaining; // 末期校正
        }
        remaining = round2(remaining - pPart);
        const payment = round2(pPart + interest);
        rows.push({
          seq: i + 1,
          dueDate: dueDates[i],
          payment,
          principalPart: round2(pPart),
          interestPart: round2(interest),
          remainingPrincipal: round2(remaining),
        });
      }
    }

    return rows;
  }

  // ==================== CRUD ====================

  async createLoan(userId: string, dto: CreateLoanDto) {
    const ledger = await this.ledgersService.getLedger(dto.ledgerId, userId);
    const schedule = this.computeSchedule({
      principal: dto.principal,
      annualRate: dto.annualRate,
      termMonths: dto.termMonths,
      method: dto.method,
      startDate: new Date(dto.startDate),
    });

    const loan = await this.prisma.loan.create({
      data: {
        familyId: ledger.familyId,
        ledgerId: dto.ledgerId,
        accountId: dto.accountId || null,
        name: dto.name,
        principal: dto.principal,
        annualRate: dto.annualRate,
        termMonths: dto.termMonths,
        method: dto.method,
        startDate: new Date(dto.startDate),
      },
    });

    await this.prisma.loanSchedule.createMany({
      data: schedule.map((s) => ({
        loanId: loan.id,
        seq: s.seq,
        dueDate: s.dueDate,
        payment: s.payment,
        principalPart: s.principalPart,
        interestPart: s.interestPart,
        remainingPrincipal: s.remainingPrincipal,
        status: 'pending',
      })),
    });

    this.logger.log(`贷款创建: id=${loan.id}, name=${dto.name}, term=${dto.termMonths}, by=${userId}`);
    return this.getLoan(loan.id, userId);
  }

  async listLoans(userId: string, familyId: string) {
    await this.familiesService.validateFamilyMember(familyId, userId);
    return this.prisma.loan.findMany({
      where: { familyId },
      orderBy: { createdAt: 'desc' },
      include: { schedules: { orderBy: { seq: 'asc' } } },
    });
  }

  async getLoan(id: string, userId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: { schedules: { orderBy: { seq: 'asc' } } },
    });
    if (!loan) throw new NotFoundException('贷款不存在');
    await this.familiesService.validateFamilyMember(loan.familyId, userId);
    return loan;
  }

  async updateLoan(id: string, userId: string, dto: UpdateLoanDto) {
    const existing = await this.getLoan(id, userId);

    const familyId = (await this.ledgersService.getLedger(
      dto.ledgerId || existing.ledgerId,
      userId,
    )).familyId;
    if (familyId !== existing.familyId) {
      throw new BadRequestException('不能跨家庭修改贷款');
    }

    const principal = dto.principal ?? Number(existing.principal);
    const annualRate = dto.annualRate ?? Number(existing.annualRate);
    const termMonths = dto.termMonths ?? existing.termMonths;
    const method = dto.method ?? existing.method;
    const startDate = dto.startDate ? new Date(dto.startDate) : existing.startDate;

    // 仅允许在未生成还款交易前重算计划（避免计划与已生成交易不一致）
    const generated = await this.prisma.loanSchedule.count({
      where: { loanId: id, status: 'paid' },
    });
    if (generated > 0) {
      throw new BadRequestException('已生成还款交易的贷款不可修改计划参数');
    }

    const schedule = this.computeSchedule({
      principal,
      annualRate,
      termMonths,
      method,
      startDate,
    });

    await this.prisma.$transaction([
      this.prisma.loan.update({
        where: { id },
        data: {
          ledgerId: dto.ledgerId ?? existing.ledgerId,
          accountId: dto.accountId !== undefined ? dto.accountId : existing.accountId,
          name: dto.name ?? existing.name,
          principal,
          annualRate,
          termMonths,
          method,
          startDate,
        },
      }),
      this.prisma.loanSchedule.deleteMany({ where: { loanId: id } }),
      this.prisma.loanSchedule.createMany({
        data: schedule.map((s) => ({
          loanId: id,
          seq: s.seq,
          dueDate: s.dueDate,
          payment: s.payment,
          principalPart: s.principalPart,
          interestPart: s.interestPart,
          remainingPrincipal: s.remainingPrincipal,
          status: 'pending',
        })),
      }),
    ]);

    return this.getLoan(id, userId);
  }

  async deleteLoan(id: string, userId: string) {
    const existing = await this.getLoan(id, userId);
    // 删除贷款级联删除计划（外键 RESTRICT，这里先删计划再删贷款）
    await this.prisma.$transaction([
      this.prisma.loanSchedule.deleteMany({ where: { loanId: id } }),
      this.prisma.loan.delete({ where: { id } }),
    ]);
    return { success: true };
  }

  // ==================== 生成还款交易 ====================

  /**
   * 为到期（dueDate<=upto）的 pending 计划生成单笔还款 EXPENSE 交易。
   * metadata 记本金/利息明细；generatedTxId 回写计划；status→paid。
   */
  async generatePayments(id: string, userId: string, dto: GenerateLoanDto) {
    const loan = await this.getLoan(id, userId);
    const upto = dto.upto ? new Date(dto.upto) : new Date();

    const pending = await this.prisma.loanSchedule.findMany({
      where: { loanId: id, status: 'pending', dueDate: { lte: upto } },
      orderBy: { seq: 'asc' },
    });

    let generated = 0;
    for (const s of pending) {
      const tx = await this.createRepaymentTransaction(loan, s, userId);
      await this.prisma.loanSchedule.update({
        where: { id: s.id },
        data: { status: 'paid', generatedTxId: tx.id },
      });
      generated++;
    }

    this.logger.log(`贷款生成还款: loan=${id}, generated=${generated}, by=${userId}`);
    return { generated };
  }

  /** 单笔还款交易（复用 createTransaction 内部余额校正 + WS 事件） */
  private async createRepaymentTransaction(loan: any, schedule: any, userId: string) {
    const createDto: CreateTransactionDto = {
      ledgerId: loan.ledgerId,
      accountId: loan.accountId ?? null,
      type: 'expense',
      amount: schedule.payment,
      date: schedule.dueDate.toISOString(),
      merchant: loan.name,
      note: `第${schedule.seq}期还款（本金${schedule.principalPart}/利息${schedule.interestPart}）`,
      source: 'manual',
      metadata: {
        kind: 'loan_repayment',
        loanId: loan.id,
        scheduleSeq: schedule.seq,
        principalPart: schedule.principalPart,
        interestPart: schedule.interestPart,
        remainingPrincipal: schedule.remainingPrincipal,
      },
    } as CreateTransactionDto;

    return this.transactionsService.createTransaction(userId, createDto);
  }
}

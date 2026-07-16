import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { FamiliesService } from '../families/families.service';
import { LedgersService } from '../ledgers/ledgers.service';
import { TransactionsService } from '../transactions/transactions.service';
import {
  CreateAdvanceDto,
  CollectAdvanceDto,
  UpdateAdvanceDto,
} from './dto/create-advance.dto';
import { CreateTransactionDto } from '../transactions/dto/create-transaction.dto';

/** 四舍五入保留2位 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 垫付服务
 * - registerAdvance：先创建源 EXPENSE 交易（垫付是真实支出），再登记 AdvanceReceivable。
 * - collect：生成 INCOME 收款交易（advanceOfId 关联），更新 repaid/remaining/status（支持部分归还，末期校正）。
 * 所有资金流复用 TransactionsService.createTransaction（内部余额校正 + WS 事件）。
 */
@Injectable()
export class AdvancesService {
  private readonly logger = new Logger(AdvancesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly familiesService: FamiliesService,
    private readonly ledgersService: LedgersService,
    private readonly transactionsService: TransactionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ==================== 登记垫付 ====================

  async registerAdvance(userId: string, dto: CreateAdvanceDto) {
    const ledger = await this.ledgersService.getLedger(dto.ledgerId, userId);
    const familyId = ledger.familyId;

    // 垫付人必须是该家庭成员
    await this.familiesService.validateFamilyMember(familyId, dto.payerId);

    // 1) 创建源 EXPENSE 交易（垫付是真实支出，计入净支出）
    const tx = await this.transactionsService.createTransaction(dto.payerId, {
      ledgerId: dto.ledgerId,
      accountId: dto.accountId || null,
      categoryId: dto.categoryId || null,
      type: 'expense',
      amount: dto.amount,
      date: new Date().toISOString(),
      merchant: undefined,
      note: `垫付:${dto.debtorName}`,
      source: 'manual',
    } as CreateTransactionDto);

    // 2) 登记应收
    const advance = await this.prisma.advanceReceivable.create({
      data: {
        familyId,
        ledgerId: dto.ledgerId,
        accountId: dto.accountId || null,
        payerId: dto.payerId,
        debtorName: dto.debtorName,
        debtorType: dto.debtorType,
        sourceTxId: tx.id,
        amount: dto.amount,
        repaidAmount: 0,
        remainingAmount: dto.amount,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        status: 'PENDING',
        note: dto.note || null,
      },
    });

    this.logger.log(
      `垫付登记: advance=${advance.id}, payer=${dto.payerId}, debtor=${dto.debtorName}, amount=${dto.amount}, by=${userId}`,
    );
    return this.getAdvance(advance.id, userId);
  }

  // ==================== 列表 / 详情 ====================

  async listAdvances(userId: string, familyId: string, status?: string) {
    await this.familiesService.validateFamilyMember(familyId, userId);
    return this.prisma.advanceReceivable.findMany({
      where: status ? { familyId, status: status as never } : { familyId },
      orderBy: { createdAt: 'desc' },
      include: { sourceTx: true },
    });
  }

  async getAdvance(id: string, userId: string) {
    const advance = await this.prisma.advanceReceivable.findUnique({
      where: { id },
      include: { sourceTx: true },
    });
    if (!advance) throw new NotFoundException('垫付记录不存在');
    await this.familiesService.validateFamilyMember(advance.familyId, userId);
    return advance;
  }

  async updateAdvance(id: string, userId: string, dto: UpdateAdvanceDto) {
    const existing = await this.getAdvance(id, userId);
    return this.prisma.advanceReceivable.update({
      where: { id },
      data: {
        debtorName: dto.debtorName ?? existing.debtorName,
        dueDate:
          dto.dueDate !== undefined
            ? dto.dueDate
              ? new Date(dto.dueDate)
              : null
            : existing.dueDate,
        note: dto.note !== undefined ? dto.note : existing.note,
      },
      include: { sourceTx: true },
    });
  }

  async deleteAdvance(id: string, userId: string) {
    const existing = await this.getAdvance(id, userId);
    // 仅删除应收登记，源支出交易保留为真实支出（不破坏账务）
    await this.prisma.advanceReceivable.delete({ where: { id } });
    this.logger.log(`垫付删除: advance=${id}, by=${userId}`);
    return { success: true };
  }

  // ==================== 收回垫付 ====================

  /**
   * 收回垫付（支持部分归还，末期校正）。
   * 生成 INCOME 收款交易（advanceOfId 关联），更新 repaid/remaining/status。
   */
  async collect(id: string, userId: string, dto: CollectAdvanceDto) {
    const advance = await this.getAdvance(id, userId);

    if (advance.status === 'RECOVERED' || advance.status === 'CANCELLED') {
      throw new BadRequestException(`该垫付已${advance.status === 'RECOVERED' ? '全部收回' : '取消'}，无法再收回`);
    }

    const remaining = Number(advance.remainingAmount);
    // 末期校正：收回额不超过剩余应收
    const collected = round2(Math.min(round2(dto.amount), remaining));
    if (collected <= 0) {
      throw new BadRequestException('收回金额必须大于0且不超过剩余应收');
    }

    const newRemaining = round2(remaining - collected);
    const repaidAmount = round2(Number(advance.repaidAmount) + collected);
    const isFinal = newRemaining <= 0.005;
    const status = isFinal ? 'RECOVERED' : 'PARTIAL';

    // 生成收款 INCOME 交易（advanceOfId 关联）
    await this.transactionsService.createTransaction(userId, {
      ledgerId: advance.ledgerId,
      accountId: dto.accountId ?? advance.accountId ?? null,
      type: 'income',
      amount: collected,
      date: dto.date,
      merchant: undefined,
      note: `垫付收回:${advance.debtorName}`,
      source: 'manual',
      advanceOfId: advance.id,
    } as CreateTransactionDto);

    const updated = await this.prisma.advanceReceivable.update({
      where: { id },
      data: {
        repaidAmount,
        remainingAmount: isFinal ? 0 : newRemaining,
        status,
      },
      include: { sourceTx: true },
    });

    this.logger.log(
      `垫付收回: advance=${id}, collected=${collected}, remaining=${updated.remainingAmount}, status=${status}, by=${userId}`,
    );
    return { repaidAmount: updated.repaidAmount, remainingAmount: updated.remainingAmount, status: updated.status };
  }
}

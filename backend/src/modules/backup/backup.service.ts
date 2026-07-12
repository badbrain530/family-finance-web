import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { FamiliesService } from '../families/families.service';
import { RestoreBackupDto, BackupPayload } from './dto/restore-backup.dto';

/** 备份格式版本 */
const BACKUP_VERSION = '1.0';

/**
 * 备份服务
 * 导出=只读聚合 7 类核心数据；恢复=单 family 事务内 deleteMany→createMany（覆盖模式）。
 * 权限：OWNER/ADMIN。
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly familiesService: FamiliesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 全量导出（只读聚合）
   * 聚合 7 类核心数据：ledgers/categories/accounts/transactions/budgets/wish_goals/monthly_reports
   */
  async exportData(userId: string, familyId: string): Promise<BackupPayload> {
    await this.familiesService.validateFamilyRole(familyId, userId, ['OWNER', 'ADMIN']);

    const [
      ledgers,
      categories,
      accounts,
      transactions,
      budgets,
      wishGoals,
      monthlyReports,
      recurringRules,
      loans,
    ] = await Promise.all([
      this.prisma.ledger.findMany({ where: { familyId } }),
      this.prisma.category.findMany({ where: { familyId } }),
      this.prisma.account.findMany({ where: { familyId } }),
      this.prisma.transaction.findMany({ where: { ledger: { familyId } } }),
      this.prisma.budget.findMany({ where: { familyId } }),
      this.prisma.wishGoal.findMany({ where: { familyId } }),
      this.prisma.monthlyReport.findMany({ where: { familyId } }),
      this.prisma.recurringRule.findMany({ where: { familyId } }),
      this.prisma.loan.findMany({ where: { familyId }, include: { schedules: true } }),
    ]);

    this.logger.log(`备份导出: family=${familyId}, by=${userId}`);
    return {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      familyId,
      data: {
        ledgers,
        categories,
        accounts,
        transactions,
        budgets,
        wish_goals: wishGoals,
        monthly_reports: monthlyReports,
        recurring_rules: recurringRules,
        loans,
      },
    };
  }

  /**
   * 覆盖模式恢复（同家庭，事务包裹）
   * 顺序：ledgers→categories→accounts→budgets→wish_goals→monthly_reports→transactions
   * 失败整体回滚；返回各类型影响条数。
   */
  async restore(
    userId: string,
    dto: RestoreBackupDto,
  ): Promise<{ restored: Record<string, number> } | { counts: Record<string, number> }> {
    await this.familiesService.validateFamilyRole(dto.familyId, userId, ['OWNER', 'ADMIN']);

    const payload = dto.payload as BackupPayload;
    if (!payload || !payload.data) {
      throw new BadRequestException('备份数据格式不合法');
    }

    const familyId = dto.familyId;
    const d = payload.data;

    // 仅预览：返回各类型将影响的条数
    if (dto.previewOnly) {
      const counts: Record<string, number> = {
        ledgers: Array.isArray(d.ledgers) ? d.ledgers.length : 0,
        categories: Array.isArray(d.categories) ? d.categories.length : 0,
        accounts: Array.isArray(d.accounts) ? d.accounts.length : 0,
        transactions: Array.isArray(d.transactions) ? d.transactions.length : 0,
        budgets: Array.isArray(d.budgets) ? d.budgets.length : 0,
        wish_goals: Array.isArray(d.wish_goals) ? d.wish_goals.length : 0,
        monthly_reports: Array.isArray(d.monthly_reports) ? d.monthly_reports.length : 0,
        recurring_rules: Array.isArray(d.recurring_rules) ? d.recurring_rules.length : 0,
        loans: Array.isArray(d.loans) ? d.loans.length : 0,
      };
      return { counts };
    }

    // 事务内执行（覆盖模式，同家庭 ID 可复用）。
    // 删除顺序严格按外键依赖「子表先于父表」排列 —— Transaction/Loan/RecurringRule 等
    // 均引用 ledger/category/account 且 schema 默认 RESTRICT，若先删父表会抛外键冲突导致整笔回滚。
    const restored = await this.prisma.$transaction(async (tx) => {
      const result: Record<string, number> = {};

      // 1. 贷款还款计划（loan_schedules，先于 loans）
      const loans = (d.loans as any[]) || [];
      const loanSchedules = loans.flatMap((l) =>
        ((l.schedules as any[]) || []).map((s) => ({ ...s, loanId: l.id })),
      );
      await tx.loanSchedule.deleteMany({ where: { loan: { familyId } } });
      if (loanSchedules.length > 0) await tx.loanSchedule.createMany({ data: loanSchedules });
      result['loan_schedules'] = loanSchedules.length;

      // 2. 贷款（剥离 schedules 嵌套后插入）
      const loanRows = loans.map(({ schedules, ...rest }) => rest);
      await tx.loan.deleteMany({ where: { familyId } });
      if (loanRows.length > 0) await tx.loan.createMany({ data: loanRows });
      result['loans'] = loanRows.length;

      // 3. 周期记账规则（引用 ledger/category，先于二者删除）
      const recurringRules = (d.recurring_rules as any[]) || [];
      await tx.recurringRule.deleteMany({ where: { familyId } });
      if (recurringRules.length > 0) await tx.recurringRule.createMany({ data: recurringRules });
      result['recurring_rules'] = recurringRules.length;

      // 4. 交易（引用 ledger/category/account，先于这些父表删除）
      const transactions = (d.transactions as any[]) || [];
      await tx.transaction.deleteMany({ where: { ledger: { familyId } } });
      if (transactions.length > 0) await tx.transaction.createMany({ data: transactions });
      result['transactions'] = transactions.length;

      // 5. 预算（引用 category/wish_goal，先于二者删除）
      const budgets = (d.budgets as any[]) || [];
      await tx.budget.deleteMany({ where: { familyId } });
      if (budgets.length > 0) await tx.budget.createMany({ data: budgets });
      result['budgets'] = budgets.length;

      // 6. 心愿目标（被 budgets 引用，后于 budgets 删除）
      const wishGoals = (d.wish_goals as any[]) || [];
      await tx.wishGoal.deleteMany({ where: { familyId } });
      if (wishGoals.length > 0) await tx.wishGoal.createMany({ data: wishGoals });
      result['wish_goals'] = wishGoals.length;

      // 7. 账户（被 transactions 引用，已先删；先于 ledgers 删除）
      const accounts = (d.accounts as any[]) || [];
      await tx.account.deleteMany({ where: { familyId } });
      if (accounts.length > 0) await tx.account.createMany({ data: accounts });
      result['accounts'] = accounts.length;

      // 8. 分类（被 transactions/budgets 引用，已先删）
      const categories = (d.categories as any[]) || [];
      await tx.category.deleteMany({ where: { familyId } });
      if (categories.length > 0) await tx.category.createMany({ data: categories });
      result['categories'] = categories.length;

      // 9. 账本（最后删，所有引用它的子表已清）
      const ledgers = (d.ledgers as any[]) || [];
      await tx.ledger.deleteMany({ where: { familyId } });
      if (ledgers.length > 0) await tx.ledger.createMany({ data: ledgers });
      result['ledgers'] = ledgers.length;

      // 10. 月度报告（仅引用 family）
      const monthlyReports = (d.monthly_reports as any[]) || [];
      await tx.monthlyReport.deleteMany({ where: { familyId } });
      if (monthlyReports.length > 0) await tx.monthlyReport.createMany({ data: monthlyReports });
      result['monthly_reports'] = monthlyReports.length;

      return result;
    });

    this.eventEmitter.emit('backup.restored', { familyId, userId, restored });
    this.logger.log(`备份恢复: family=${familyId}, by=${userId}, ${JSON.stringify(restored)}`);
    return { restored };
  }
}

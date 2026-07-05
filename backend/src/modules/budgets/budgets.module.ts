import { Module } from '@nestjs/common';
import { BudgetsService } from './budgets.service';
import { BudgetsController } from './budgets.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { FamiliesModule } from '../families/families.module';

/**
 * 预算模块
 * 功能：预算CRUD、预算执行计算、预算预警（EventEmitter触发budget.alert事件）
 *
 * 依赖：
 * - PrismaModule: 数据库操作
 * - FamiliesModule: 家庭成员权限验证
 */
@Module({
  imports: [PrismaModule, FamiliesModule],
  controllers: [BudgetsController],
  providers: [BudgetsService],
  exports: [BudgetsService],
})
export class BudgetsModule {}

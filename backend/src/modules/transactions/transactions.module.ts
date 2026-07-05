import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { LedgersModule } from '../ledgers/ledgers.module';
import { CategoriesModule } from '../categories/categories.module';
import { FamiliesModule } from '../families/families.module';

/**
 * 交易模块
 * 核心业务模块：交易CRUD、快捷记账、批量操作
 */
@Module({
  imports: [
    PrismaModule,
    LedgersModule,
    CategoriesModule,
    FamiliesModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}

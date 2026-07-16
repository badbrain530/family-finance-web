import { Module } from '@nestjs/common';
import { AdvancesService } from './advances.service';
import { AdvancesController } from './advances.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { FamiliesModule } from '../families/families.module';
import { LedgersModule } from '../ledgers/ledgers.module';
import { TransactionsModule } from '../transactions/transactions.module';

/**
 * 垫付模块
 */
@Module({
  imports: [PrismaModule, FamiliesModule, LedgersModule, TransactionsModule],
  controllers: [AdvancesController],
  providers: [AdvancesService],
  exports: [AdvancesService],
})
export class AdvancesModule {}

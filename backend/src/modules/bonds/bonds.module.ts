import { Module } from '@nestjs/common';
import { BondsService } from './bonds.service';
import { BondsController } from './bonds.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { FamiliesModule } from '../families/families.module';
import { LedgersModule } from '../ledgers/ledgers.module';
import { TransactionsModule } from '../transactions/transactions.module';

/**
 * 债券模块（仅 HELD 持有方）
 */
@Module({
  imports: [PrismaModule, FamiliesModule, LedgersModule, TransactionsModule],
  controllers: [BondsController],
  providers: [BondsService],
  exports: [BondsService],
})
export class BondsModule {}

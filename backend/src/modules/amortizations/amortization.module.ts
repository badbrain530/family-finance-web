import { Module } from '@nestjs/common';
import { AmortizationService } from './amortization.service';
import { AmortizationController } from './amortization.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { FamiliesModule } from '../families/families.module';
import { LedgersModule } from '../ledgers/ledgers.module';
import { TransactionsModule } from '../transactions/transactions.module';

/**
 * 待摊/预付模块
 */
@Module({
  imports: [PrismaModule, FamiliesModule, LedgersModule, TransactionsModule],
  controllers: [AmortizationController],
  providers: [AmortizationService],
  exports: [AmortizationService],
})
export class AmortizationModule {}

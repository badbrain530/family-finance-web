import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { FamiliesModule } from '../families/families.module';
import { TransactionsModule } from '../transactions/transactions.module';

/**
 * 账户模块
 * imports: PrismaModule（数据库）、FamiliesModule（家庭隔离校验）
 */
@Module({
  imports: [PrismaModule, FamiliesModule, TransactionsModule],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}

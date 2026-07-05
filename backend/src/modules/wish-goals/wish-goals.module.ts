import { Module } from '@nestjs/common';
import { WishGoalsService } from './wish-goals.service';
import { WishGoalsController } from './wish-goals.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { FamiliesModule } from '../families/families.module';

/**
 * 心愿目标模块
 * 功能：心愿目标CRUD、进度计算、预算关联
 *
 * 依赖：
 * - PrismaModule: 数据库操作
 * - FamiliesModule: 家庭成员权限验证
 */
@Module({
  imports: [PrismaModule, FamiliesModule],
  controllers: [WishGoalsController],
  providers: [WishGoalsService],
  exports: [WishGoalsService],
})
export class WishGoalsModule {}

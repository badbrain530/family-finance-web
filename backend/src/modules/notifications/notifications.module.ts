import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { FamiliesModule } from '../families/families.module';

/**
 * 通知模块
 * 功能：通知CRUD、分页查询、标记已读、事件监听创建通知
 *
 * 事件监听（通过@OnEvent装饰器自动注册）：
 * - budget.alert → 预算预警通知
 * - transaction.large_expense → 大额支出通知
 * - report.ready → 月报生成通知
 * - import.completed → 导入完成通知
 * - family.member_joined → 成员加入通知
 *
 * 依赖：
 * - PrismaModule: 数据库操作
 * - FamiliesModule: 查询家庭成员（用于创建家庭通知）
 */
@Module({
  imports: [PrismaModule, FamiliesModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

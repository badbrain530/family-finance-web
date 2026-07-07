import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule as AppConfigModule } from './config/config.module';
import { HealthController } from './health.controller';

// T02 业务模块
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { FamiliesModule } from './modules/families/families.module';
import { LedgersModule } from './modules/ledgers/ledgers.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { WebsocketModule } from './modules/websocket/websocket.module';

// T04 业务模块
import { ImportsModule } from './modules/imports/imports.module';
import { AiModule } from './modules/ai/ai.module';

// T05 业务模块
import { BudgetsModule } from './modules/budgets/budgets.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WishGoalsModule } from './modules/wish-goals/wish-goals.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';

// 全局JWT认证守卫
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

/**
 * 应用根模块
 * 注册全局模块和业务模块
 */
@Module({
  imports: [
    // 环境变量配置
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),

    // 事件总线（@nestjs/event-emitter）
    // MVP阶段必须做的预留：跨模块解耦，新增模块只需监听事件
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
    }),

    // 定时任务
    ScheduleModule.forRoot(),

    // API限流
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1分钟
        limit: 100, // 每分钟100次
      },
    ]),

    // 基础设施模块
    AppConfigModule,
    PrismaModule,

    // ===== T02 业务模块 =====
    AuthModule,
    UsersModule,
    FamiliesModule,
    LedgersModule,
    CategoriesModule,
    TransactionsModule,
    AccountsModule,
    WebsocketModule,

    // ===== T04 业务模块 =====
    AiModule,
    ImportsModule,

    // ===== T05 业务模块 =====
    BudgetsModule,
    NotificationsModule,
    WishGoalsModule,
    DashboardModule,
    ReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    // 全局限流守卫
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // 全局JWT认证守卫（@Public()装饰器可跳过认证）
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}

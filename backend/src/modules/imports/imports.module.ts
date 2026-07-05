/**
 * 账单导入模块
 * 包含：控制器、服务、解析器工厂、5个平台解析器
 *
 * 依赖：
 * - PrismaModule（数据库）
 * - AiModule（AI分类服务）
 * - EventEmitterModule（已在全局注册）
 */

import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { ParserFactory } from './parsers/parser.factory';
import { AlipayParser } from './parsers/alipay.parser';
import { WechatParser } from './parsers/wechat.parser';
import { CmbParser } from './parsers/cmb.parser';
import { IcbcParser } from './parsers/icbc.parser';
import { CcbParser } from './parsers/ccb.parser';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [ImportsController],
  providers: [
    ImportsService,
    ParserFactory,
    AlipayParser,
    WechatParser,
    CmbParser,
    IcbcParser,
    CcbParser,
  ],
  exports: [ImportsService],
})
export class ImportsModule {}

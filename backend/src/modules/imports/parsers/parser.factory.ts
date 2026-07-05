/**
 * 账单解析器工厂
 * 根据平台标识返回对应的Parser实例
 *
 * 设计模式：工厂模式
 * - 新增平台只需创建新Parser并在此注册
 * - 调用方无需关心具体Parser实现
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { IBillParser, ImportPlatformType } from './parser.interface';
import { AlipayParser } from './alipay.parser';
import { WechatParser } from './wechat.parser';
import { CmbParser } from './cmb.parser';
import { IcbcParser } from './icbc.parser';
import { CcbParser } from './ccb.parser';

@Injectable()
export class ParserFactory {
  /** 解析器实例缓存 */
  private readonly parsers: Map<ImportPlatformType, IBillParser>;

  constructor(
    private readonly alipayParser: AlipayParser,
    private readonly wechatParser: WechatParser,
    private readonly cmbParser: CmbParser,
    private readonly icbcParser: IcbcParser,
    private readonly ccbParser: CcbParser,
  ) {
    this.parsers = new Map();
    this.parsers.set('alipay', this.alipayParser);
    this.parsers.set('wechat', this.wechatParser);
    this.parsers.set('cmb', this.cmbParser);
    this.parsers.set('icbc', this.icbcParser);
    this.parsers.set('ccb', this.ccbParser);
  }

  /**
   * 获取指定平台的解析器
   * @param platform 平台标识
   * @returns 解析器实例
   * @throws BadRequestException 不支持的平台
   */
  getParser(platform: string): IBillParser {
    const parser = this.parsers.get(platform as ImportPlatformType);
    if (!parser) {
      throw new BadRequestException(
        `不支持的平台: ${platform}，当前支持: alipay, wechat, cmb, icbc, ccb`,
      );
    }
    return parser;
  }

  /**
   * 获取所有支持的平台列表
   * @returns 平台标识数组
   */
  getSupportedPlatforms(): string[] {
    return Array.from(this.parsers.keys());
  }
}

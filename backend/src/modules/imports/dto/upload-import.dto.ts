/**
 * 上传账单DTO
 */
import { IsString, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

/**
 * 支持的导入平台枚举
 */
export enum ImportPlatform {
  ALIPAY = 'alipay',
  WECHAT = 'wechat',
  CMB = 'cmb',
  ICBC = 'icbc',
  CCB = 'ccb',
}

export class UploadImportDto {
  /** 账单来源平台 */
  @IsEnum(ImportPlatform, { message: '平台必须是 alipay/wechat/cmb/icbc/ccb 之一' })
  platform: ImportPlatform;

  /** 家庭ID */
  @IsString({ message: '家庭ID必须是字符串' })
  @IsNotEmpty({ message: '家庭ID不能为空' })
  familyId: string;

  /** 账本ID（导入到哪个账本） */
  @IsString({ message: '账本ID必须是字符串' })
  @IsNotEmpty({ message: '账本ID不能为空' })
  ledgerId: string;
}

/**
 * 解析已上传文件DTO
 * 对已上传但未解析的文件触发解析
 */
export class ParseImportDto {
  /** 指定文件名（如果文件已上传） */
  @IsOptional()
  @IsString()
  fileName?: string;
}

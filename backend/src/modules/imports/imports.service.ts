/**
 * 账单导入服务
 * 编排完整的导入流程：文件上传 → 解析 → AI分类预览 → 确认导入
 *
 * MVP阶段文件存储：本地 uploads/ 目录
 * 后续可替换为阿里云OSS
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { ParserFactory } from './parsers/parser.factory';
import { ParsedTransaction, ParseResult } from './parsers/parser.interface';
import { AiClassificationService } from '../ai/ai-classification.service';
import { ConfirmImportDto, ConfirmTransactionItem } from './dto/confirm-import.dto';

/** 文件上传根目录 */
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

/** 允许的文件扩展名 */
const ALLOWED_EXTENSIONS = ['.csv', '.html', '.htm', '.pdf', '.txt'];

/** 最大文件大小（10MB） */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** 大额支出阈值（元） */
const LARGE_EXPENSE_THRESHOLD = 1000;

/**
 * 解析预览结果（返回给前端）
 */
export interface ImportPreviewResult {
  importId: string;
  status: string;
  totalCount: number;
  transactions: PreviewTransaction[];
  parseErrors: string[];
}

/**
 * 预览交易（含AI分类结果）
 */
export interface PreviewTransaction {
  date: string;
  amount: number;
  type: 'income' | 'expense';
  description: string;
  merchant: string | null;
  categoryId: string | null;
  categoryName: string | null;
  confidence: number;
  classificationSource: 'rule' | 'llm' | 'none';
  transactionNo: string | null;
  paymentMethod: string | null;
  isLowConfidence: boolean;
}

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly parserFactory: ParserFactory,
    private readonly aiClassificationService: AiClassificationService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // 确保上传目录存在
    this.ensureUploadDir();
  }

  // ==================== 文件上传 + 解析 ====================

  /**
   * 上传账单文件并自动解析
   * 1. 保存文件到本地
   * 2. 创建ImportRecord
   * 3. 调用Parser解析
   * 4. 调用AI分类
   * 5. 返回预览数据
   *
   * @param userId 用户ID
   * @param familyId 家庭ID
   * @param ledgerId 账本ID
   * @param platform 平台
   * @param file 上传的文件
   * @returns 导入预览结果
   */
  async uploadAndParse(
    userId: string,
    familyId: string,
    ledgerId: string,
    platform: string,
    file: { originalname: string; buffer: Buffer; size: number },
  ): Promise<ImportPreviewResult> {
    // 验证文件
    this.validateFile(file);

    // 保存文件到本地
    const filePath = await this.saveFile(file, platform);

    // 创建导入记录
    const importRecord = await this.prisma.importRecord.create({
      data: {
        userId,
        familyId,
        ledgerId,
        platform: platform.toUpperCase() as 'ALIPAY' | 'WECHAT' | 'CMB' | 'ICBC' | 'CCB',
        fileName: file.originalname,
        fileUrl: filePath,
        totalCount: 0,
        successCount: 0,
        failedCount: 0,
        status: 'PARSING',
      },
    });

    try {
      // 调用Parser解析
      const parser = this.parserFactory.getParser(platform);
      const parseResult: ParseResult = parser.parse(file.buffer);

      // 更新总数
      await this.prisma.importRecord.update({
        where: { id: importRecord.id },
        data: { totalCount: parseResult.transactions.length },
      });

      // AI分类
      const previewTransactions = await this.classifyBatch(
        parseResult.transactions,
        familyId,
      );

      // 更新导入记录状态为预览
      await this.prisma.importRecord.update({
        where: { id: importRecord.id },
        data: { status: 'PREVIEW' },
      });

      this.logger.log(
        `账单上传解析完成: importId=${importRecord.id}, platform=${platform}, ` +
        `total=${parseResult.transactions.length}, skipped=${parseResult.skippedCount}`,
      );

      return {
        importId: importRecord.id,
        status: 'PREVIEW',
        totalCount: previewTransactions.length,
        transactions: previewTransactions,
        parseErrors: parseResult.errors,
      };
    } catch (error) {
      // 解析失败，更新状态
      await this.prisma.importRecord.update({
        where: { id: importRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });

      this.logger.error(
        `账单解析失败: importId=${importRecord.id}, error=${error instanceof Error ? error.message : String(error)}`,
      );

      throw error;
    }
  }

  // ==================== 解析已上传文件 ====================

  /**
   * 重新解析已上传的文件
   * @param importId 导入记录ID
   * @param userId 用户ID
   * @returns 预览结果
   */
  async reparse(importId: string, userId: string): Promise<ImportPreviewResult> {
    const importRecord = await this.getImportRecord(importId, userId);

    if (importRecord.status === 'CONFIRMED') {
      throw new BadRequestException('已确认导入的记录不能重新解析');
    }

    // 读取文件
    const fileBuffer = fs.readFileSync(importRecord.fileUrl);

    // 解析
    const parser = this.parserFactory.getParser(importRecord.platform.toLowerCase());
    const parseResult = parser.parse(fileBuffer);

    // AI分类
    const previewTransactions = await this.classifyBatch(
      parseResult.transactions,
      importRecord.familyId,
    );

    // 更新记录
    await this.prisma.importRecord.update({
      where: { id: importId },
      data: {
        totalCount: parseResult.transactions.length,
        status: 'PREVIEW',
        errorMessage: null,
      },
    });

    return {
      importId,
      status: 'PREVIEW',
      totalCount: previewTransactions.length,
      transactions: previewTransactions,
      parseErrors: parseResult.errors,
    };
  }

  // ==================== 确认导入 ====================

  /**
   * 确认导入：将预览数据批量写入Transaction表
   * @param userId 用户ID
   * @param dto 确认导入DTO
   * @returns 导入摘要
   */
  async confirmImport(
    userId: string,
    dto: ConfirmImportDto,
  ): Promise<{
    successCount: number;
    failedCount: number;
    aiAccuracy: number;
  }> {
    const importRecord = await this.getImportRecord(dto.importId, userId);

    if (importRecord.status === 'CONFIRMED') {
      throw new BadRequestException('该导入记录已确认，不能重复导入');
    }

    let successCount = 0;
    let failedCount = 0;
    let correctClassifications = 0;
    let totalClassifications = 0;

    // 批量创建交易
    for (const item of dto.transactions) {
      try {
        // 判断是否大额支出
        const isLargeExpense =
          item.type === 'expense' && item.amount >= LARGE_EXPENSE_THRESHOLD;

        // 创建交易
        const transaction = await this.prisma.transaction.create({
          data: {
            ledgerId: dto.ledgerId,
            userId,
            categoryId: item.categoryId || null,
            type: item.type.toUpperCase() as 'INCOME' | 'EXPENSE',
            amount: item.amount,
            date: new Date(item.date),
            merchant: item.merchant || null,
            note: item.description || null,
            source: 'IMPORT',
            importRecordId: dto.importId,
            aiConfidence: item.aiConfidence || null,
            aiCorrected: item.aiCorrected || false,
            isLargeExpense,
          },
        });

        successCount++;

        // 统计AI分类准确率
        if (item.categoryId) {
          totalClassifications++;
          if (!item.aiCorrected) {
            correctClassifications++;
          }
        }

        // 如果用户纠正了分类，保存反馈
        if (item.aiCorrected && item.categoryId) {
          await this.aiClassificationService.saveFeedback({
            transactionId: transaction.id,
            userId,
            originalCategoryId: null, // 原始AI分类（如果有）
            correctedCategoryId: item.categoryId,
            merchant: item.merchant || '',
            amount: item.amount,
          });
        }

        // 发出交易创建事件（WebSocket同步）
        this.eventEmitter.emit('transaction.created', {
          transaction,
          ledgerId: dto.ledgerId,
          familyId: importRecord.familyId,
          userId,
        });
      } catch (err) {
        failedCount++;
        this.logger.error(
          `导入交易失败: importId=${dto.importId}, error=${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 计算AI准确率
    const aiAccuracy = totalClassifications > 0 ? correctClassifications / totalClassifications : null;

    // 更新导入记录
    await this.prisma.importRecord.update({
      where: { id: dto.importId },
      data: {
        successCount,
        failedCount,
        aiAccuracy,
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      },
    });

    // 发出导入完成事件
    this.eventEmitter.emit('import.completed', {
      importId: dto.importId,
      familyId: importRecord.familyId,
      userId,
      successCount,
      aiAccuracy: aiAccuracy || 0,
    });

    this.logger.log(
      `导入确认完成: importId=${dto.importId}, success=${successCount}, failed=${failedCount}, accuracy=${aiAccuracy}`,
    );

    return {
      successCount,
      failedCount,
      aiAccuracy: aiAccuracy || 0,
    };
  }

  // ==================== 导入历史 ====================

  /**
   * 获取导入历史列表
   * @param userId 用户ID
   * @param familyId 家庭ID（可选，过滤特定家庭）
   * @param page 页码
   * @param pageSize 每页条数
   * @returns 分页导入记录列表
   */
  async getImportList(
    userId: string,
    familyId?: string,
    page: number = 1,
    pageSize: number = 20,
  ) {
    const where: Record<string, unknown> = { userId };

    if (familyId) {
      where.familyId = familyId;
    }

    const total = await this.prisma.importRecord.count({ where });

    const items = await this.prisma.importRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取单条导入记录详情
   * @param importId 导入记录ID
   * @param userId 用户ID
   * @returns 导入记录 + 关联交易
   */
  async getImportDetail(importId: string, userId: string) {
    const importRecord = await this.getImportRecord(importId, userId);

    // 获取关联的交易
    const transactions = await this.prisma.transaction.findMany({
      where: { importRecordId: importId },
      include: {
        category: {
          select: { id: true, name: true, icon: true, color: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    return { importRecord, transactions };
  }

  /**
   * 删除导入记录（及其关联的交易）
   * @param importId 导入记录ID
   * @param userId 用户ID
   * @returns 操作结果
   */
  async deleteImport(importId: string, userId: string): Promise<{ success: boolean }> {
    const importRecord = await this.getImportRecord(importId, userId);

    // 删除关联的交易
    await this.prisma.transaction.deleteMany({
      where: { importRecordId: importId },
    });

    // 删除导入记录
    await this.prisma.importRecord.delete({
      where: { id: importId },
    });

    // 删除文件
    try {
      if (fs.existsSync(importRecord.fileUrl)) {
        fs.unlinkSync(importRecord.fileUrl);
      }
    } catch (err) {
      this.logger.warn(`文件删除失败: ${importRecord.fileUrl}, ${err instanceof Error ? err.message : String(err)}`);
    }

    this.logger.log(`导入记录删除: importId=${importId}, by=${userId}`);

    return { success: true };
  }

  // ==================== 内部方法 ====================

  /**
   * 批量AI分类
   * 对解析出的交易列表进行分类（规则引擎优先，LLM兜底）
   * @param transactions 解析出的交易列表
   * @param familyId 家庭ID
   * @returns 带分类结果的预览交易列表
   */
  private async classifyBatch(
    transactions: ParsedTransaction[],
    familyId: string,
  ): Promise<PreviewTransaction[]> {
    const result: PreviewTransaction[] = [];

    for (const tx of transactions) {
      // 调用AI分类服务
      const classification = await this.aiClassificationService.classify({
        description: tx.description,
        merchant: tx.merchant || '',
        amount: tx.amount,
        type: tx.type,
        familyId,
      });

      result.push({
        date: tx.date.toISOString(),
        amount: tx.amount,
        type: tx.type,
        description: tx.description,
        merchant: tx.merchant,
        categoryId: classification.categoryId,
        categoryName: classification.categoryName,
        confidence: classification.confidence,
        classificationSource: classification.source,
        transactionNo: tx.transactionNo,
        paymentMethod: tx.paymentMethod,
        isLowConfidence: classification.confidence < 0.7,
      });
    }

    return result;
  }

  /**
   * 获取导入记录（并验证权限）
   */
  private async getImportRecord(importId: string, userId: string) {
    const importRecord = await this.prisma.importRecord.findUnique({
      where: { id: importId },
    });

    if (!importRecord) {
      throw new NotFoundException('导入记录不存在');
    }

    if (importRecord.userId !== userId) {
      throw new BadRequestException('无权操作此导入记录');
    }

    return importRecord;
  }

  /**
   * 验证上传文件
   */
  private validateFile(file: { originalname: string; size: number }): void {
    if (!file || !file.originalname) {
      throw new BadRequestException('文件不能为空');
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(
        `不支持的文件格式: ${ext}，支持: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('文件大小不能超过10MB');
    }
  }

  /**
   * 保存文件到本地uploads目录
   * @param file 文件对象
   * @param platform 平台标识
   * @returns 文件存储路径
   */
  private async saveFile(
    file: { originalname: string; buffer: Buffer },
    platform: string,
  ): Promise<string> {
    // 生成文件名：平台_时间戳_原始文件名
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^\w.\-]/g, '_');
    const fileName = `${platform}_${timestamp}_${safeName}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, file.buffer, (err) => {
        if (err) {
          reject(new BadRequestException(`文件保存失败: ${err.message}`));
        } else {
          resolve(filePath);
        }
      });
    });
  }

  /**
   * 确保上传目录存在
   */
  private ensureUploadDir(): void {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      this.logger.log(`创建上传目录: ${UPLOAD_DIR}`);
    }
  }
}

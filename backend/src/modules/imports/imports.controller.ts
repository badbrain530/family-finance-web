/**
 * 账单导入控制器
 * 提供账单上传、解析、确认、历史查询接口
 *
 * 路由前缀: /api/imports
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportsService } from './imports.service';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { ConfirmImportDto } from './dto/confirm-import.dto';

@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  /**
   * 上传账单文件并自动解析
   * POST /api/imports/upload
   * multipart/form-data: file, platform, familyId, ledgerId
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAndParse(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('platform') platform: string,
    @Body('familyId') familyId: string,
    @Body('ledgerId') ledgerId: string,
  ) {
    if (!file) {
      return { error: '文件不能为空' };
    }

    return this.importsService.uploadAndParse(
      user.userId,
      familyId,
      ledgerId,
      platform,
      {
        originalname: file.originalname,
        buffer: file.buffer,
        size: file.size,
      },
    );
  }

  /**
   * 重新解析已上传文件
   * POST /api/imports/:id/parse
   */
  @Post(':id/parse')
  async reparse(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.importsService.reparse(id, user.userId);
  }

  /**
   * 确认导入（将预览数据写入交易表）
   * POST /api/imports/confirm
   */
  @Post('confirm')
  async confirmImport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmImportDto,
  ) {
    return this.importsService.confirmImport(user.userId, dto);
  }

  /**
   * 获取导入历史列表
   * GET /api/imports
   */
  @Get()
  async getImportList(
    @CurrentUser() user: AuthenticatedUser,
    @Query('familyId') familyId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.importsService.getImportList(
      user.userId,
      familyId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  /**
   * 获取单条导入记录详情（含关联交易）
   * GET /api/imports/:id
   */
  @Get(':id')
  async getImportDetail(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.importsService.getImportDetail(id, user.userId);
  }

  /**
   * 删除导入记录（及其关联交易）
   * DELETE /api/imports/:id
   */
  @Delete(':id')
  async deleteImport(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.importsService.deleteImport(id, user.userId);
  }
}

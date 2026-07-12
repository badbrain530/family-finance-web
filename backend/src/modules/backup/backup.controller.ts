import { Controller, Get, Post, Query, Body, BadRequestException } from '@nestjs/common';
import { BackupService } from './backup.service';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { RestoreBackupDto } from './dto/restore-backup.dto';

/**
 * 数据备份控制器
 */
@Controller('backup')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  /**
   * 全量导出（只读聚合）
   * GET /api/backup/export?familyId=&scope=full
   */
  @Get('export')
  async exportData(
    @CurrentUser() user: AuthenticatedUser,
    @Query('familyId') familyId: string,
    @Query('scope') scope: string,
  ) {
    if (!familyId) throw new BadRequestException('familyId 必填');
    return this.backupService.exportData(user.userId, familyId);
  }

  /**
   * 覆盖模式恢复（同家庭，事务）
   * POST /api/backup/restore
   */
  @Post('restore')
  async restore(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RestoreBackupDto,
  ) {
    return this.backupService.restore(user.userId, dto);
  }
}

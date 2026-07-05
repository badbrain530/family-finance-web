import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { QueryNotificationDto, MarkReadDto } from './dto/create-notification.dto';

/**
 * 通知控制器
 * 提供通知列表查询、未读数、标记已读、删除接口
 *
 * 路由前缀：/api/notifications
 * 所有接口需要JWT认证
 */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * 获取通知列表（分页+筛选）
   * GET /api/notifications?unreadOnly=true&type=LARGE_EXPENSE&page=1&pageSize=20
   *
   * 返回：{ items, total, unreadCount, page, pageSize }
   */
  @Get()
  async getNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryNotificationDto,
  ) {
    return this.notificationsService.getNotifications(user.userId, query);
  }

  /**
   * 获取未读通知数量
   * GET /api/notifications/unread-count
   */
  @Get('unread-count')
  async getUnreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getUnreadCount(user.userId);
  }

  /**
   * 标记单条通知为已读
   * PUT /api/notifications/:id/read
   */
  @Put(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.markAsRead(user.userId, id);
  }

  /**
   * 批量标记已读
   * PUT /api/notifications/read-all
   * Body: { ids?: string[] } — 为空表示标记全部已读
   */
  @Put('read-all')
  async markAllAsRead(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MarkReadDto,
  ) {
    return this.notificationsService.markAllAsRead(user.userId, dto.ids);
  }

  /**
   * 删除通知
   * DELETE /api/notifications/:id
   */
  @Delete(':id')
  async deleteNotification(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notificationsService.deleteNotification(user.userId, id);
  }
}

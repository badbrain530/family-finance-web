import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { FamiliesService } from './families.service';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateFamilyDto, UpdateFamilyDto, UpdateMemberRoleDto } from './dto/create-family.dto';
import { JoinFamilyDto } from './dto/join-family.dto';

/**
 * 家庭控制器
 * 管理家庭创建、成员邀请、加入、角色管理
 */
@Controller('families')
export class FamiliesController {
  constructor(private readonly familiesService: FamiliesService) {}

  /**
   * 创建家庭
   * POST /api/families
   */
  @Post()
  async createFamily(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFamilyDto,
  ) {
    return this.familiesService.createFamily(user.userId, dto);
  }

  /**
   * 获取当前用户的家庭列表
   * GET /api/families
   */
  @Get()
  async getMyFamilies(@CurrentUser() user: AuthenticatedUser) {
    return this.familiesService.getUserFamilies(user.userId);
  }

  /**
   * 获取家庭信息
   * GET /api/families/:id
   */
  @Get(':id')
  async getFamily(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.familiesService.getFamily(id, user.userId);
  }

  /**
   * 更新家庭信息
   * PUT /api/families/:id
   */
  @Put(':id')
  async updateFamily(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateFamilyDto,
  ) {
    return this.familiesService.updateFamily(id, user.userId, dto);
  }

  /**
   * 生成新的邀请码
   * POST /api/families/:id/invite
   */
  @Post(':id/invite')
  async generateInviteCode(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.familiesService.generateInviteCode(id, user.userId);
  }

  /**
   * 通过邀请码加入家庭
   * POST /api/families/join
   */
  @Post('join')
  async joinFamily(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: JoinFamilyDto,
  ) {
    return this.familiesService.joinFamily(user.userId, dto);
  }

  /**
   * 获取家庭成员列表
   * GET /api/families/:id/members
   */
  @Get(':id/members')
  async getMembers(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.familiesService.getMembers(id, user.userId);
  }

  /**
   * 更新成员角色
   * PUT /api/families/:id/members/:userId
   */
  @Put(':id/members/:userId')
  async updateMemberRole(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.familiesService.updateMemberRole(id, targetUserId, user.userId, dto);
  }

  /**
   * 移除家庭成员
   * DELETE /api/families/:id/members/:userId
   */
  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.familiesService.removeMember(id, targetUserId, user.userId);
  }
}

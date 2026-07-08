import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateCategoryDto, UpdateCategoryDto, ReorderCategoriesDto } from './dto/create-category.dto';

/**
 * 分类控制器
 * 管理家庭分类体系
 */
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * 获取家庭分类列表（树形）
   * GET /api/categories?familyId=xxx
   */
  @Get()
  async getCategories(
    @Query('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categoriesService.getCategories(familyId, user.userId);
  }

  /**
   * 创建自定义分类
   * POST /api/categories
   */
  @Post()
  async createCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoriesService.createCategory(user.userId, dto);
  }

  /**
   * 重排序分类
   * PUT /api/categories/reorder
   * 注意：必须声明在 @Put(':id') 之前，避免被 ':id' 路由捕获 'reorder'
   */
  @Put('reorder')
  async reorderCategories(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderCategoriesDto,
  ) {
    return this.categoriesService.reorderCategories(dto.familyId, user.userId, dto);
  }

  /**
   * 更新分类
   * PUT /api/categories/:id
   */
  @Put(':id')
  async updateCategory(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.updateCategory(id, user.userId, dto);
  }

  /**
   * 删除分类
   * DELETE /api/categories/:id
   */
  @Delete(':id')
  async deleteCategory(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categoriesService.deleteCategory(id, user.userId);
  }

  /**
   * 初始化默认分类（国标8大类支出 + 4类收入）
   * POST /api/categories/init
   */
  @Post('init')
  async initCategories(
    @Body('familyId') familyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categoriesService.initCategories(familyId, user.userId);
  }
}

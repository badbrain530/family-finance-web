import { get, post, put, del } from './api';
import type {
  Category,
  CreateCategoryRequest,
  ReorderCategoriesRequest,
} from '@/types/transaction';

/**
 * 分类API服务
 * ⚠️ 路径对齐：后端暴露的是 GET /api/categories?familyId=（见 categories.controller.ts），
 *    历史前端误写成 /families/:id/categories，本期已修正（设计 §8.8 坑点）。
 */

/** 分类列表（树形） */
export function getCategories(familyId: string): Promise<Category[]> {
  return get<Category[]>('/categories', { familyId });
}

/** 创建分类 */
export function createCategory(familyId: string, data: CreateCategoryRequest): Promise<Category> {
  return post<Category>('/categories', { ...data, familyId });
}

/** 更新分类 */
export function updateCategory(id: string, data: Partial<CreateCategoryRequest>): Promise<Category> {
  return put<Category>(`/categories/${id}`, data);
}

/** 删除分类 */
export function deleteCategory(id: string): Promise<{ success: boolean }> {
  return del(`/categories/${id}`);
}

/** 初始化国标分类体系（新家庭首次进入引导） */
export function initCategories(familyId: string): Promise<{ success: boolean; count: number }> {
  return post('/categories/init', { familyId });
}

/** 重排序分类 */
export function reorderCategories(familyId: string, data: ReorderCategoriesRequest): Promise<{ success: boolean }> {
  return put(`/categories/reorder`, { familyId, ...data });
}

import { get, post, put, del } from './api';
import type {
  Category,
  CreateCategoryRequest,
  ReorderCategoriesRequest,
} from '@/types/transaction';

/**
 * 分类API服务
 */

/** 分类列表（树形） */
export function getCategories(familyId: string): Promise<Category[]> {
  return get<Category[]>(`/families/${familyId}/categories`);
}

/** 创建分类 */
export function createCategory(familyId: string, data: CreateCategoryRequest): Promise<Category> {
  return post<Category>(`/families/${familyId}/categories`, data);
}

/** 更新分类 */
export function updateCategory(id: string, data: Partial<CreateCategoryRequest>): Promise<Category> {
  return put<Category>(`/categories/${id}`, data);
}

/** 删除分类 */
export function deleteCategory(id: string): Promise<{ success: boolean }> {
  return del(`/categories/${id}`);
}

/** 重排序分类 */
export function reorderCategories(familyId: string, data: ReorderCategoriesRequest): Promise<{ success: boolean }> {
  return put(`/families/${familyId}/categories/reorder`, data);
}

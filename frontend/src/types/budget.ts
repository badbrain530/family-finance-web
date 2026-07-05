/**
 * 预算/心愿目标类型定义
 */

/** 预算周期 */
export type BudgetPeriod = 'monthly';

/** 预算 */
export interface Budget {
  id: string;
  familyId: string;
  categoryId: string | null;
  amount: number;
  period: BudgetPeriod;
  year: number;
  month: number;
  wishGoalId: string | null;
  createdAt: string;
  updatedAt: string;
  category?: import('./transaction').Category;
  wishGoal?: WishGoal;
}

/** 心愿目标 */
export interface WishGoal {
  id: string;
  familyId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  icon: string;
  color: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 预算执行进度 */
export interface BudgetProgress {
  total: {
    budget: number;
    spent: number;
    remaining: number;
    percentage: number;
  };
  categories: Array<{
    categoryId: string;
    categoryName: string;
    categoryColor: string;
    budget: number;
    spent: number;
    remaining: number;
    percentage: number;
  }>;
}

/** AI推荐预算 */
export interface AIRecommendBudget {
  recommendations: Array<{
    categoryId: string;
    amount: number;
    reason: string;
  }>;
}

/** 创建预算请求 */
export interface CreateBudgetRequest {
  categoryId?: string;
  amount: number;
  year: number;
  month: number;
  wishGoalId?: string;
}

/** 更新预算请求 */
export interface UpdateBudgetRequest {
  amount?: number;
  wishGoalId?: string;
}

/** 创建心愿目标请求 */
export interface CreateWishGoalRequest {
  name: string;
  targetAmount: number;
  targetDate?: string;
  icon: string;
  color: string;
}

/** 更新心愿目标请求 */
export interface UpdateWishGoalRequest {
  name?: string;
  targetAmount?: number;
  targetDate?: string;
}

/** 预算预警类型 */
export type BudgetAlertType = 'warning' | 'exceeded' | 'success';

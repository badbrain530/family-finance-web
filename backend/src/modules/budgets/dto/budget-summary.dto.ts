/**
 * 预算执行进度DTO
 * 对应前端 BudgetProgress 类型
 */

/** 分类预算执行进度项 */
export interface CategoryBudgetProgress {
  /** 分类ID */
  categoryId: string;
  /** 分类名称 */
  categoryName: string;
  /** 分类颜色 */
  categoryColor: string;
  /** 预算金额 */
  budget: number;
  /** 已使用金额 */
  spent: number;
  /** 剩余金额 */
  remaining: number;
  /** 使用百分比 */
  percentage: number;
}

/** 预算执行进度汇总 */
export interface BudgetProgressResult {
  /** 总预算执行进度 */
  total: {
    budget: number;
    spent: number;
    remaining: number;
    percentage: number;
  };
  /** 各分类预算执行进度 */
  categories: CategoryBudgetProgress[];
}

/**
 * 预算预警类型
 * - warning: 支出达80%预警
 * - exceeded: 支出达100%超支
 * - success: 预算达成（月底未超支）
 */
export type BudgetAlertType = 'warning' | 'exceeded' | 'success';

/**
 * 预算预警事件payload
 */
export interface BudgetAlertPayload {
  /** 预警类型 */
  type: BudgetAlertType;
  /** 家庭ID */
  familyId: string;
  /** 分类ID（null表示总预算） */
  categoryId: string | null;
  /** 分类名称 */
  categoryName: string;
  /** 使用百分比 */
  percentage: number;
  /** 预算金额 */
  budgetAmount: number;
  /** 已使用金额 */
  spentAmount: number;
  /** 预警消息 */
  message: string;
  /** 年份 */
  year: number;
  /** 月份 */
  month: number;
}

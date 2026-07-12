import { IsNotEmpty, IsString, IsOptional, IsIn, IsObject } from 'class-validator';

/**
 * 恢复请求DTO
 * P0 仅支持 overwrite（同家庭覆盖式恢复）；预览模式不写入。
 */
export class RestoreBackupDto {
  /** 目标家庭ID（P0 必须与原备份家庭一致） */
  @IsNotEmpty({ message: 'familyId 必填' })
  @IsString()
  readonly familyId: string;

  /** 备份载荷（与导出结构一致） */
  @IsObject()
  readonly payload: Record<string, any>;

  /** 恢复模式（P0 仅 overwrite） */
  @IsIn(['overwrite'])
  readonly mode: 'overwrite';

  /** 仅预览影响条数，不写入 */
  @IsOptional()
  readonly previewOnly?: boolean;
}

/** 备份载荷结构（导出返回，恢复入参复用） */
export interface BackupPayload {
  version: string;
  exportedAt: string;
  familyId: string;
  data: {
    ledgers: any[];
    categories: any[];
    accounts: any[];
    transactions: any[];
    budgets: any[];
    wish_goals: any[];
    monthly_reports: any[];
    recurring_rules: any[];
    loans: any[];
  };
}

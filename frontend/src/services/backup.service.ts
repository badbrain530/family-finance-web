import { get, post } from './api';
import type { BackupPayload } from '@/types/transaction';

/**
 * 数据备份服务
 * 严格对齐后端 BackupController / RestoreBackupDto
 *
 * 路由映射：
 *   GET  /api/backup/export?familyId=  → exportBackup（拿到 JSON 后触发浏览器下载）
 *   POST /api/backup/restore           → restoreBackup（覆盖式恢复）
 */

/** 恢复模式（P0 仅 overwrite 覆盖式） */
export type RestoreMode = 'overwrite';

/** 恢复请求（对齐 RestoreBackupDto） */
export interface RestoreBackupRequest {
  /** 目标家庭ID（P0 必须与原备份家庭一致） */
  familyId: string;
  /** 备份载荷（与导出结构一致） */
  payload: BackupPayload;
  /** 恢复模式 */
  mode: RestoreMode;
  /** 仅预览影响条数，不写入 */
  previewOnly?: boolean;
}

/** 恢复结果 */
export interface RestoreBackupResult {
  /** 覆盖写入后各类型恢复条数（非预览时返回） */
  restored?: Record<string, number>;
  /** 预览模式各类型影响条数 */
  counts?: Record<string, number>;
}

/**
 * 全量导出 → JSON Blob 触发浏览器下载
 * GET /api/backup/export?familyId= 返回 BackupPayload，本函数负责下载并记录文件名后返回该载荷。
 */
export async function exportBackup(familyId: string): Promise<BackupPayload> {
  const payload = await get<BackupPayload>('/backup/export', { familyId });

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const date = new Date().toISOString().slice(0, 10);
  link.download = `family-finance-backup-${familyId}-${date}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return payload;
}

/**
 * 覆盖式恢复 POST /api/backup/restore
 * P0 仅支持 overwrite（同家庭覆盖式恢复）。
 */
export function restoreBackup(req: RestoreBackupRequest): Promise<RestoreBackupResult> {
  return post<RestoreBackupResult>('/backup/restore', req);
}

import { describe, it, expect, vi } from 'vitest';
import { getDueInfo } from './dueDate';

/**
 * getDueInfo 单元测试
 *
 * 覆盖场景：
 *   A. 空值（null / 0 / undefined）返回 null
 *   B. 不跨月：2026-07-10 查 15 号 → 当月 7/15，days=5
 *   C. 跨月：2026-07-20 查 5 号（已过本月 5 号）→ 下月 8/5，isNextMonth=true
 *   D. 短月兜底（不跨月）：2026-02-01 查 31 号 → 当月 2/28（2026 非闰年）
 *   E. 跨月 + 短月兜底：2026-02-28 中午 查 31 号 → 推下月 3/31
 *
 * 说明：用 vi.useFakeTimers() + vi.setSystemTime() 隔离"今天"，每个用例结束
 * 用 vi.useRealTimers() 还原，避免互相污染。days 用 toBeCloseTo(_, 0) 断言：
 * 对整数 days 等价于精确相等，但能容忍测试机时区/夏令时带来的毫秒级误差。
 * 跨月与否由 isNextMonth（与毫秒无关）与 dueDay 兜底共同判定。
 */
describe('getDueInfo - 信用卡账单日/还款日跨月展示', () => {
  it('A. 空值返回 null：null / 0 / undefined', () => {
    expect(getDueInfo(null)).toBeNull();
    expect(getDueInfo(0)).toBeNull();
    // 运行期 undefined 进入 !paymentDueDay 分支同样返回 null（类型上为 number|null，
    // 这里用 as never 仅为通过类型检查，运行期值仍是 undefined）
    expect(getDueInfo(undefined as never)).toBeNull();
  });

  it('B. 不跨月：2026-07-10 查 15 号 → 7/15，days=5', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 6, 10)); // 2026-07-10 00:00 本地时间
      const r = getDueInfo(15);
      expect(r).not.toBeNull();
      expect(r!.isNextMonth).toBe(false);
      expect(r!.dueDay).toBe(15);
      expect(r!.days).toBeCloseTo(5, 0); // 7/10 -> 7/15 = 5 天
    } finally {
      vi.useRealTimers();
    }
  });

  it('C. 跨月：2026-07-20 查 5 号（已过本月 5 号）→ 下月 8/5，days=16', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 6, 20)); // 2026-07-20 00:00
      const r = getDueInfo(5);
      expect(r).not.toBeNull();
      expect(r!.isNextMonth).toBe(true);
      expect(r!.dueDay).toBe(5);
      expect(r!.days).toBeCloseTo(16, 0); // 7/20 -> 8/5 = 16 天
    } finally {
      vi.useRealTimers();
    }
  });

  it('D. 短月兜底（不跨月）：2026-02-01 查 31 号 → 当月 2/28，days=27', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 1, 1)); // 2026 非闰年，2 月只有 28 天
      const r = getDueInfo(31);
      expect(r).not.toBeNull();
      expect(r!.isNextMonth).toBe(false);
      expect(r!.dueDay).toBe(28); // 31 在 2 月按最后一天 28 兜底
      expect(r!.days).toBeCloseTo(27, 0); // 2/1 -> 2/28 = 27 天
    } finally {
      vi.useRealTimers();
    }
  });

  it('E. 跨月 + 短月兜底：2026-02-28 中午 查 31 号 → 推下月 3/31，days=31', () => {
    vi.useFakeTimers();
    try {
      // 用当天中午，确保 due(2/28 0 点) < now(2/28 中午) 成立，触发跨月；
      // 若用 0 点则 due==now 不触发跨月（同程设计已说明）。
      vi.setSystemTime(new Date(2026, 1, 28, 12, 0, 0)); // 2026-02-28 12:00
      const r = getDueInfo(31);
      expect(r).not.toBeNull();
      expect(r!.isNextMonth).toBe(true);
      expect(r!.dueDay).toBe(31); // 下月 3 月有 31 天，短月兜底后仍是 31
      expect(r!.days).toBeCloseTo(31, 0); // 2/28 12:00 -> 3/31 0:00 = 30.5 天，向上取整 31
    } finally {
      vi.useRealTimers();
    }
  });
});

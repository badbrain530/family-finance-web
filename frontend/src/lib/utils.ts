import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 通用工具函数
 * 包含：className合并、日期格式化、金额格式化等
 */

/**
 * 合并Tailwind CSS类名（shadcn/ui标准工具函数）
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ==================== 金额格式化 ====================

/**
 * 格式化金额为中文货币格式
 * @param amount 金额（元）
 * @param currency 货币代码，默认CNY
 * @returns 格式化后的金额字符串，如 "¥1,234.56"
 */
export function formatCurrency(amount: number, currency: string = 'CNY'): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '¥0.00';
  }
  const formatted = Math.abs(amount).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const symbol = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : '';
  const sign = amount < 0 ? '-' : '';
  return `${sign}${symbol}${formatted}`;
}

/**
 * 格式化金额（带正负号，用于收支展示）
 * @param amount 金额
 * @param type 交易类型 income/expense/transfer
 * @returns 如 "+¥1,234.56" 或 "-¥56.00"
 */
export function formatAmountWithType(amount: number, type: 'income' | 'expense' | 'transfer'): string {
  const formatted = formatCurrency(amount);
  if (type === 'income') {
    return `+${formatted}`;
  }
  if (type === 'expense') {
    return `-${formatted}`;
  }
  return formatted;
}

/**
 * 格式化百分比
 * @param value 百分比值（0-1或0-100）
 * @param decimals 小数位数
 * @returns 如 "82.5%"
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  const percent = value <= 1 ? value * 100 : value;
  return `${percent.toFixed(decimals)}%`;
}

/**
 * 格式化紧凑数字（大数字简写）
 * @param num 数字
 * @returns 如 "1.2万" / "350" / "2.5亿"
 */
export function formatCompactNumber(num: number): string {
  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(1)}亿`;
  }
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}万`;
  }
  return num.toLocaleString('zh-CN');
}

// ==================== 日期格式化 ====================

/**
 * 格式化日期
 * @param date 日期字符串(ISO)或Date对象
 * @param formatStr 格式化模式，默认 'yyyy-MM-dd'
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: string | Date | null, formatStr: string = 'yyyy-MM-dd'): string {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '';
  return format(d, formatStr, { locale: zhCN });
}

/**
 * 格式化日期时间
 * @param date 日期字符串或Date对象
 * @returns 如 "2026-07-04 14:30"
 */
export function formatDateTime(date: string | Date | null): string {
  return formatDate(date, 'yyyy-MM-dd HH:mm');
}

/**
 * 格式化相对时间
 * @param date 日期字符串或Date对象
 * @returns 如 "3小时前" / "2天前"
 */
export function formatRelativeTime(date: string | Date | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '';
  return formatDistanceToNow(d, { addSuffix: true, locale: zhCN });
}

/**
 * 获取月份范围
 * @param year 年
 * @param month 月 (1-12)
 * @returns { start: Date, end: Date }
 */
export function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

/**
 * 获取当前年月
 * @returns { year: number, month: number }
 */
export function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

// ==================== 其他工具 ====================

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number = 300,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  interval: number = 300,
): (...args: Parameters<T>) => void {
  let lastTime = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn(...args);
    }
  };
}

/**
 * 生成唯一ID（基于nanoid）
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

/**
 * 复制文本到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * 下载文件
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 检测是否为移动端
 */
export function isMobile(): boolean {
  return window.innerWidth < 768;
}

/**
 * 检测是否为PWA模式
 */
export function isPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches;
}

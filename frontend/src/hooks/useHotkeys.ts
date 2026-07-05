import { useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useUIStore } from '@/store/uiStore';

/**
 * 全局快捷键Hook
 * 注册全局快捷键：
 * - Ctrl+K / Cmd+K：打开快捷记账面板
 * - Ctrl+Shift+K / Cmd+Shift+K：打开命令面板
 */
export function useGlobalHotkeys(): void {
  const { setQuickRecordOpen, setCommandPaletteOpen } = useUIStore();

  // Ctrl+K 快捷记账
  useHotkeys('mod+k', (event) => {
    event.preventDefault();
    setQuickRecordOpen(true);
  }, { enableOnFormTags: true });

  // Ctrl+Shift+K 命令面板
  useHotkeys('mod+shift+k', (event) => {
    event.preventDefault();
    setCommandPaletteOpen(true);
  }, { enableOnFormTags: true });

  // Esc 关闭所有面板
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setQuickRecordOpen(false);
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [setQuickRecordOpen, setCommandPaletteOpen]);
}

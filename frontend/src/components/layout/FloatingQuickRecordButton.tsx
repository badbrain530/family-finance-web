import { Plus } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

/**
 * 移动端快捷记账悬浮按钮 (FAB)
 * 仅在移动端显示（< 768px）
 * 位于底部导航栏上方，点击唤出 QuickRecordModal
 */
export function FloatingQuickRecordButton() {
  const { setQuickRecordOpen } = useUIStore();

  return (
    <button
      onClick={() => setQuickRecordOpen(true)}
      className="md:hidden fixed right-4 bottom-20 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-white shadow-lg active:scale-90 transition-transform"
      aria-label="快捷记账"
    >
      <Plus size={28} />
    </button>
  );
}

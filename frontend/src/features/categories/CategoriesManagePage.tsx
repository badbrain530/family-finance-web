import { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Lock, Sparkles } from 'lucide-react';
import { getCurrentFamily } from '@/services/family.service';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  initCategories,
} from '@/services/category.service';
import { useToast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Category, CreateCategoryRequest } from '@/types/transaction';
import type { Family } from '@/types/family';
import { getCategoryIcon } from '@/features/categories/categoryIcons';
import { ALL_ICON_KEYS, ICON_COLOR } from '@/features/categories/categoryIconMeta';
import { CategoryIcon } from '@/components/common/CategoryIcon';

/** 分组 A：设计师新图标（25 个分类图标 key，顺序见 ALL_ICON_KEYS） */
// 分组 B：经典 lucide 图标名（PascalCase，与默认分类数据 icon 约定一致；存储即 PascalCase）
const LUCIDE_ICON_OPTIONS = [
  'Utensils', 'Car', 'Home', 'ShoppingBag', 'BookOpen', 'HeartPulse',
  'Gamepad', 'Users', 'Shield', 'Wallet', 'Coffee', 'Gift', 'Plane',
  'Film', 'Dumbbell', 'Map', 'Pill', 'GraduationCap', 'Briefcase', 'TrendingUp',
  'Smartphone', 'Zap', 'CreditCard', 'Banknote', 'PiggyBank', 'MoreHorizontal',
];

/**
 * 分类管理页
 * 左：一级分类列表（可折叠/选中）；右：选中大类下的二级分类网格
 * 支持二级分类增删改查、系统分类锁定、新家庭初始化引导
 *
 * 图标与配色策略（单一来源）：
 * - 图标：从 ALL_ICON_KEYS 中选择，存为图标 key（CategoryIconKey）
 * - 配色：随所选图标自动赋值对应设计 token（ICON_COLOR[key]），不再提供自由调色板
 */
export function CategoriesManagePage() {
  const { toast } = useToast();
  const [family, setFamily] = useState<Family | null>(null);
  const [categories, setCategories] = useState<Category[]>([]); // 一级分类（含 children）
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initing, setIniting] = useState(false);

  // 二级分类编辑弹窗
  const [formOpen, setFormOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('other');
  const [formColor, setFormColor] = useState(ICON_COLOR.other);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const fam = await getCurrentFamily();
      setFamily(fam);
      const list = await getCategories(fam.id);
      setCategories(list);
      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    } catch (err: any) {
      toast({ title: '加载分类失败', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedParent = useMemo(
    () => categories.find((c) => c.id === selectedId) || categories[0] || null,
    [categories, selectedId],
  );

  const handleInit = async () => {
    if (!family) return;
    setIniting(true);
    try {
      await initCategories(family.id);
      toast({ title: '分类体系已初始化', variant: 'success' });
      await load();
    } catch (err: any) {
      toast({ title: '初始化失败', description: err?.message, variant: 'destructive' });
    } finally {
      setIniting(false);
    }
  };

  const openCreate = () => {
    if (!selectedParent) return;
    setEditingCat(null);
    setFormName('');
    setFormIcon('other');
    setFormColor(ICON_COLOR.other);
    setFormOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCat(cat);
    setFormName(cat.name);
    setFormIcon(cat.icon);
    setFormColor(cat.color);
    setFormOpen(true);
  };

  const handleSaveForm = async () => {
    if (!family || !selectedParent) return;
    if (!formName.trim()) {
      toast({ title: '请输入分类名称', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload: CreateCategoryRequest = {
        name: formName.trim(),
        parentId: selectedParent.id,
        icon: formIcon,
        color: formColor,
      };
      if (editingCat) {
        await updateCategory(editingCat.id, payload);
        toast({ title: '分类已更新', variant: 'success' });
      } else {
        await createCategory(family.id, payload);
        toast({ title: '分类已添加', variant: 'success' });
      }
      setFormOpen(false);
      await load();
    } catch (err: any) {
      toast({ title: '保存失败', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (cat.isSystem) {
      toast({ title: '系统分类不可删除', variant: 'destructive' });
      return;
    }
    try {
      await deleteCategory(cat.id);
      toast({ title: '分类已删除', variant: 'success' });
      await load();
    } catch (err: any) {
      toast({ title: '删除失败', description: err?.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="text-text-secondary">加载中...</div>
      </div>
    );
  }

  // 空状态：引导初始化
  if (categories.length === 0) {
    return (
      <div className="page-container">
        <h1 className="text-2xl font-bold text-text-primary mb-6">分类管理</h1>
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mb-3">
            <Sparkles size={26} className="text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary">尚未初始化分类</h3>
          <p className="text-text-secondary mt-1 mb-4 max-w-md">
            初始化后将自动创建国标 8 大类支出与 4 类收入分类，便于你快速记账
          </p>
          <Button onClick={handleInit} disabled={initing || !family}>
            <Sparkles size={16} className="mr-1" />
            {initing ? '初始化中...' : '初始化国标分类'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">分类管理</h1>
          <p className="text-text-secondary mt-1">管理你的一级与二级分类</p>
        </div>
        <Button variant="outline" onClick={handleInit} disabled={initing}>
          <Sparkles size={16} className="mr-1" />
          重新初始化
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        {/* 左侧：一级分类列表 */}
        <div className="card p-3 h-fit">
          <div className="text-xs text-text-tertiary px-2 py-1">一级分类（{categories.length}）</div>
          <div className="space-y-1 mt-1">
            {categories.map((cat) => {
              const Glyph = getCategoryIcon(cat.icon);
              const active = selectedParent?.id === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedId(cat.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                    active
                      ? 'bg-primary-50 text-primary-600 font-semibold'
                      : 'text-text-secondary hover:bg-primary-50/50',
                  )}
                >
                  <Glyph size={16} color={cat.color} />
                  <span className="truncate">{cat.name}</span>
                  <span className="ml-auto text-xs text-text-tertiary">
                    {cat.children?.length || 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 右侧：二级分类网格 */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-text-primary">
              {selectedParent?.name} · 二级分类
            </h2>
            <Button size="sm" onClick={openCreate}>
              <Plus size={14} className="mr-1" />
              新增二级分类
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {selectedParent?.children?.map((child) => {
              const Glyph = getCategoryIcon(child.icon);
              return (
                <div
                  key={child.id}
                  className="group relative flex items-center gap-3 p-3 rounded-lg border border-border bg-surface hover:border-primary/30 transition-colors"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: child.color + '20' }}
                  >
                    <Glyph size={18} color={child.color} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">{child.name}</div>
                    {child.isSystem && (
                      <div className="text-xs text-text-tertiary flex items-center gap-1">
                        <Lock size={10} /> 系统
                      </div>
                    )}
                  </div>

                  {/* 操作 */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(child)}
                      className="p-1 rounded text-text-tertiary hover:text-primary-600 hover:bg-primary-50"
                      title="编辑"
                    >
                      <Pencil size={13} />
                    </button>
                    {!child.isSystem && (
                      <button
                        onClick={() => handleDelete(child)}
                        className="p-1 rounded text-text-tertiary hover:text-expense hover:bg-expense/5"
                        title="删除"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {(!selectedParent?.children || selectedParent.children.length === 0) && (
              <div className="col-span-full text-sm text-text-tertiary py-8 text-center">
                暂无二级分类，点击右上角"新增二级分类"
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 二级分类编辑弹窗 */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCat ? '编辑分类' : '新增二级分类'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">分类名称</Label>
              <Input
                id="cat-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="如：外卖、打车出行"
                maxLength={20}
              />
            </div>

            <div className="space-y-1.5">
              <Label>图标（颜色随图标自动匹配）</Label>

              {/* 分组 A：设计师新图标（放大、留白充足） */}
              <div className="mb-3">
                <div className="text-xs text-text-tertiary mb-1.5">设计师新图标</div>
                <div className="grid grid-cols-7 gap-2 max-h-44 overflow-y-auto pr-1">
                  {ALL_ICON_KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      aria-label={k}
                      onClick={() => {
                        setFormIcon(k);
                        setFormColor(ICON_COLOR[k]);
                      }}
                      className={cn(
                        'w-12 h-12 rounded-lg flex items-center justify-center border transition-colors',
                        formIcon === k
                          ? 'border-primary bg-primary-50 text-primary-600 ring-2 ring-primary/40'
                          : 'border-border text-text-secondary hover:border-primary/30',
                      )}
                    >
                      <CategoryIcon iconKey={k} size={30} />
                    </button>
                  ))}
                </div>
              </div>

              {/* 分组 B：经典图标 (Lucide) */}
              <div>
                <div className="text-xs text-text-tertiary mb-1.5">经典图标 (Lucide)</div>
                <div className="grid grid-cols-8 gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {LUCIDE_ICON_OPTIONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      aria-label={ic}
                      onClick={() => {
                        // 选中经典 lucide 图标时保留当前分类原有 color，不强制改
                        setFormIcon(ic);
                      }}
                      className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center border transition-colors',
                        formIcon === ic
                          ? 'border-primary bg-primary-50 text-primary-600 ring-2 ring-primary/40'
                          : 'border-border text-text-secondary hover:border-primary/30',
                      )}
                    >
                      <CategoryIcon iconKey={ic} size={26} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveForm} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

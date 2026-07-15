import { useState, useEffect, useMemo, type ReactNode, type CSSProperties } from 'react';
import { Plus, Pencil, Trash2, Lock, Sparkles, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  rectSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getCurrentFamily } from '@/services/family.service';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  initCategories,
  reorderCategories,
} from '@/services/category.service';
import { useToast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
 * 可拖拽排序容器：负责把 useSortable 的 ref/样式/拖拽手柄属性暴露给子元素。
 * 拖拽手柄由子元素自行渲染（拿到 attributes/listeners 绑定到手柄按钮），
 * 从而把「拖拽」与「点击/编辑」区域解耦，避免拖拽时误触发编辑弹窗。
 */
function SortableWrapper({
  id,
  children,
}: {
  id: string;
  children: (handle: {
    attributes: DraggableAttributes;
    listeners: DraggableSyntheticListeners;
  }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} data-draggable={id}>
      {children({ attributes, listeners })}
    </div>
  );
}

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
  /** 是否随一级分类配色（仅二级分类有效）。true=继承父级色（保存 color=null） */
  const [formInheritColor, setFormInheritColor] = useState(true);
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

  // 拖拽：仅当指针移动超过 5px 才视为拖拽，避免与点击/编辑冲突；
  // 同时启用键盘传感器，兼顾无障碍与可测试性
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * 乐观更新 + 回滚。
   * optimistic 先更新本地顺序；保存成功则保持，失败则回滚快照并提示。
   */
  const persistReorder = async (
    items: Array<{ id: string; sortOrder: number }>,
    optimistic: () => void,
    rollback: () => void,
  ) => {
    if (!family) return;
    optimistic();
    try {
      await reorderCategories(family.id, { items });
    } catch (err: any) {
      rollback();
      toast({ title: '排序保存失败', description: err?.message, variant: 'destructive' });
    }
  };

  const handleLevel1DragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const snapshot = categories;
    const reordered = arrayMove(categories, oldIndex, newIndex);
    const items = reordered.map((c, idx) => ({ id: c.id, sortOrder: idx }));
    persistReorder(
      items,
      () => setCategories(reordered),
      () => setCategories(snapshot),
    );
  };

  const handleLevel2DragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedParent) return;
    const children = selectedParent.children ?? [];
    const oldIndex = children.findIndex((c) => c.id === active.id);
    const newIndex = children.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const snapshot = children;
    const parentId = selectedParent.id;
    const reordered = arrayMove(children, oldIndex, newIndex);
    const items = reordered.map((c, idx) => ({ id: c.id, sortOrder: idx }));
    persistReorder(
      items,
      () =>
        setCategories((prev) =>
          prev.map((c) => (c.id === parentId ? { ...c, children: reordered } : c)),
        ),
      () =>
        setCategories((prev) =>
          prev.map((c) => (c.id === parentId ? { ...c, children: snapshot } : c)),
        ),
    );
  };

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
    // 新建二级默认继承一级配色：预览显示父级色，保存时 color 发 null
    setFormColor(selectedParent.color ?? ICON_COLOR.other);
    setFormInheritColor(true);
    setFormOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCat(cat);
    setFormName(cat.name);
    setFormIcon(cat.icon);
    setFormColor(cat.color ?? '#94A3B8');
    // 一级分类恒为自身色（不显示继承开关）；二级按后端返回的 inheritColor 判定
    setFormInheritColor(cat.parentId === null ? false : (cat.inheritColor ?? false));
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
      // 是否为一级分类（编辑态且 parentId 为空才是一级；新建恒为二级）
      const isLevel1 = !!editingCat && editingCat.parentId === null;

      if (editingCat) {
        // 更新分类：不发送 parentId（后端 UpdateCategoryDto 未声明该字段，
        // 会因 forbidNonWhitelisted 被拦截返回 400）。更新也不允许改父级。
        const updatePayload: Partial<CreateCategoryRequest> = {
          name: formName.trim(),
          icon: formIcon,
        };
        if (isLevel1) {
          // 一级分类恒为自身色
          updatePayload.color = formColor;
        } else if (formInheritColor) {
          // 二级继承：color 发 null（inheritColor 作为契约冗余一并发送）
          updatePayload.color = null;
          updatePayload.inheritColor = true;
        } else {
          // 二级覆盖：发自身色
          updatePayload.color = formColor;
          updatePayload.inheritColor = false;
        }
        await updateCategory(editingCat.id, updatePayload);
        toast({ title: '分类已更新', variant: 'success' });
      } else {
        const payload: CreateCategoryRequest = {
          name: formName.trim(),
          parentId: selectedParent.id,
          icon: formIcon,
          // 二级默认继承：开启时 color 发 null（继承父级），关闭时发自身色
          color: formInheritColor ? null : formColor,
          inheritColor: formInheritColor,
        };
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
        {/* 左侧：一级分类列表（可拖拽排序） */}
        <div className="card p-3 h-fit">
          <div className="text-xs text-text-tertiary px-2 py-1">一级分类（{categories.length}）</div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleLevel1DragEnd}
          >
            <SortableContext
              items={categories.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1 mt-1">
                {categories.map((cat) => {
                  const Glyph = getCategoryIcon(cat.icon);
                  const active = selectedParent?.id === cat.id;
                  return (
                    <SortableWrapper key={cat.id} id={cat.id}>
                      {({ attributes, listeners }) => (
                        <div
                          className={cn(
                            'w-full flex items-center gap-1.5 px-2 py-2 rounded-lg text-sm transition-colors',
                            active
                              ? 'bg-primary-50 text-primary-600 font-semibold'
                              : 'text-text-secondary hover:bg-primary-50/50',
                          )}
                        >
                          <button
                            {...attributes}
                            {...listeners}
                            className="cursor-grab active:cursor-grabbing text-text-tertiary shrink-0 touch-none"
                            title="拖拽排序"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <GripVertical size={14} />
                          </button>
                          <button
                            className="flex-1 flex items-center gap-2.5 min-w-0"
                            onClick={() => setSelectedId(cat.id)}
                          >
                            <Glyph size={16} color={cat.color ?? '#94A3B8'} />
                            <span className="truncate">{cat.name}</span>
                            <span className="ml-auto text-xs text-text-tertiary">
                              {cat.children?.length || 0}
                            </span>
                          </button>
                          <button
                            onClick={() => openEdit(cat)}
                            className="p-1 rounded text-text-tertiary hover:text-primary-600 hover:bg-primary-50 shrink-0"
                            title="编辑"
                          >
                            <Pencil size={13} />
                          </button>
                        </div>
                      )}
                    </SortableWrapper>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
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

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleLevel2DragEnd}
          >
            <SortableContext
              items={(selectedParent?.children ?? []).map((c) => c.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {selectedParent?.children?.map((child) => {
                  const Glyph = getCategoryIcon(child.icon);
                  return (
                    <SortableWrapper key={child.id} id={child.id}>
                      {({ attributes, listeners }) => (
                        <div className="group relative flex items-center gap-3 p-3 rounded-lg border border-border bg-surface hover:border-primary/30 transition-colors">
                          <button
                            {...attributes}
                            {...listeners}
                            className="cursor-grab active:cursor-grabbing text-text-tertiary shrink-0 touch-none"
                            title="拖拽排序"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <GripVertical size={14} />
                          </button>
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: (child.color ?? '#94A3B8') + '20' }}
                          >
                            <Glyph size={18} color={child.color ?? '#94A3B8'} />
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
                      )}
                    </SortableWrapper>
                  );
                })}
                {(!selectedParent?.children || selectedParent.children.length === 0) && (
                  <div className="col-span-full text-sm text-text-tertiary py-8 text-center">
                    暂无二级分类，点击右上角"新增二级分类"
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>
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
                        // 继承态下不改色（预览保持父级色）；覆盖态下按图标 token 更新
                        if (!formInheritColor) setFormColor(ICON_COLOR[k]);
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

            {/* 二级分类：随一级分类配色开关（仅二级显示；一级是根，恒为自身色） */}
            {editingCat?.parentId !== null && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5">
                <div className="pr-3">
                  <div className="text-sm font-medium text-text-primary">随一级分类配色</div>
                  <div className="text-xs text-text-tertiary">
                    开启后图标颜色自动跟随「{selectedParent?.name}」，关闭可单独设置
                  </div>
                </div>
                <Switch
                  checked={formInheritColor}
                  onCheckedChange={(checked) => {
                    setFormInheritColor(checked);
                    if (checked) {
                      // 继承：预览色块切换为父级色
                      setFormColor(selectedParent?.color ?? '#94A3B8');
                    }
                  }}
                />
              </div>
            )}
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

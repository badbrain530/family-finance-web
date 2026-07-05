import { useState, useMemo } from 'react';
import { Search, Filter, Download, ChevronLeft, ChevronRight, ArrowLeftRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { AmountText } from '@/components/common/AmountText';
import { CategoryTag } from '@/components/common/CategoryTag';
import { BatchOperations } from '@/components/common/BatchOperations';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { useUIStore } from '@/store/uiStore';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DEFAULT_EXPENSE_CATEGORIES } from '@/lib/categories';
import type { Transaction, TransactionType } from '@/types/transaction';

/**
 * 交易列表页面
 * 包含：筛选栏（日期/分类/成员/金额）、表格、批量选择（W-03）、分页
 */

// 模拟交易数据
const mockTransactions: Transaction[] = [
  { id: '1', ledgerId: 'l1', userId: 'u1', categoryId: 'c1', type: 'expense' as TransactionType, amount: 35.5, date: '2026-07-04T12:30:00Z', merchant: '美团外卖', note: '午餐', source: 'quick_record' as any, importRecordId: null, aiConfidence: 0.92, aiCorrected: false, isLargeExpense: false, createdAt: '', updatedAt: '', currency: 'CNY', metadata: null, tags: [], category: { id: 'c1', name: '在外就餐', color: '#FF5252', familyId: '', parentId: null, icon: '', sortOrder: 0, isSystem: true, createdAt: '' }, user: { id: 'u1', nickname: '我', phone: null, email: null, wechatOpenId: null, avatar: null, createdAt: '', updatedAt: '' } },
  { id: '2', ledgerId: 'l1', userId: 'u1', categoryId: 'c2', type: 'income' as TransactionType, amount: 18500, date: '2026-07-01T09:00:00Z', merchant: '公司', note: '7月工资', source: 'manual' as any, importRecordId: null, aiConfidence: null, aiCorrected: false, isLargeExpense: false, createdAt: '', updatedAt: '', currency: 'CNY', metadata: null, tags: [], category: { id: 'c2', name: '基本工资', color: '#00C896', familyId: '', parentId: null, icon: '', sortOrder: 0, isSystem: true, createdAt: '' }, user: { id: 'u1', nickname: '我', phone: null, email: null, wechatOpenId: null, avatar: null, createdAt: '', updatedAt: '' } },
  { id: '3', ledgerId: 'l1', userId: 'u2', categoryId: 'c3', type: 'expense' as TransactionType, amount: 1280, date: '2026-07-03T18:00:00Z', merchant: '华润万家', note: '周末采购', source: 'manual' as any, importRecordId: null, aiConfidence: 0.88, aiCorrected: false, isLargeExpense: true, createdAt: '', updatedAt: '', currency: 'CNY', metadata: null, tags: [], category: { id: 'c3', name: '米面粮油', color: '#FF6B6B', familyId: '', parentId: null, icon: '', sortOrder: 0, isSystem: true, createdAt: '' }, user: { id: 'u2', nickname: '伴侣', phone: null, email: null, wechatOpenId: null, avatar: null, createdAt: '', updatedAt: '' } },
  { id: '4', ledgerId: 'l1', userId: 'u1', categoryId: 'c4', type: 'expense' as TransactionType, amount: 45, date: '2026-07-03T08:00:00Z', merchant: '滴滴出行', note: '打车上班', source: 'quick_record' as any, importRecordId: null, aiConfidence: 0.95, aiCorrected: false, isLargeExpense: false, createdAt: '', updatedAt: '', currency: 'CNY', metadata: null, tags: [], category: { id: 'c4', name: '出租车/网约车', color: '#FDD663', familyId: '', parentId: null, icon: '', sortOrder: 0, isSystem: true, createdAt: '' }, user: { id: 'u1', nickname: '我', phone: null, email: null, wechatOpenId: null, avatar: null, createdAt: '', updatedAt: '' } },
  { id: '5', ledgerId: 'l1', userId: 'u2', categoryId: 'c5', type: 'expense' as TransactionType, amount: 120, date: '2026-07-02T20:00:00Z', merchant: '万达影院', note: '看电影', source: 'manual' as any, importRecordId: null, aiConfidence: 0.9, aiCorrected: true, isLargeExpense: false, createdAt: '', updatedAt: '', currency: 'CNY', metadata: null, tags: [], category: { id: 'c5', name: '文化娱乐', color: '#C48EC4', familyId: '', parentId: null, icon: '', sortOrder: 0, isSystem: true, createdAt: '' }, user: { id: 'u2', nickname: '伴侣', phone: null, email: null, wechatOpenId: null, avatar: null, createdAt: '', updatedAt: '' } },
  { id: '6', ledgerId: 'l1', userId: 'u1', categoryId: 'c6', type: 'expense' as TransactionType, amount: 88, date: '2026-07-02T12:00:00Z', merchant: '肯德基', note: '午餐', source: 'quick_record' as any, importRecordId: null, aiConfidence: 0.87, aiCorrected: false, isLargeExpense: false, createdAt: '', updatedAt: '', currency: 'CNY', metadata: null, tags: [], category: { id: 'c6', name: '在外就餐', color: '#FF5252', familyId: '', parentId: null, icon: '', sortOrder: 0, isSystem: true, createdAt: '' }, user: { id: 'u1', nickname: '我', phone: null, email: null, wechatOpenId: null, avatar: null, createdAt: '', updatedAt: '' } },
  { id: '7', ledgerId: 'l1', userId: 'u1', categoryId: 'c7', type: 'expense' as TransactionType, amount: 320, date: '2026-07-01T10:00:00Z', merchant: '中国电信', note: '宽带续费', source: 'manual' as any, importRecordId: null, aiConfidence: 0.93, aiCorrected: false, isLargeExpense: false, createdAt: '', updatedAt: '', currency: 'CNY', metadata: null, tags: [], category: { id: 'c7', name: '通讯费', color: '#FFE066', familyId: '', parentId: null, icon: '', sortOrder: 0, isSystem: true, createdAt: '' }, user: { id: 'u1', nickname: '我', phone: null, email: null, wechatOpenId: null, avatar: null, createdAt: '', updatedAt: '' } },
];

export function TransactionListPage() {
  const { setQuickRecordOpen } = useUIStore();

  // 筛选状态
  const [keyword, setKeyword] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMember, setFilterMember] = useState('all');
  const [filterType, setFilterType] = useState('all');

  // 分页状态
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 批量选择状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 模拟数据
  const allTransactions = mockTransactions;

  // 过滤交易
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter((tx) => {
      // 关键词搜索
      if (keyword) {
        const kw = keyword.toLowerCase();
        const matchKeyword =
          tx.merchant?.toLowerCase().includes(kw) ||
          tx.note?.toLowerCase().includes(kw) ||
          tx.category?.name.toLowerCase().includes(kw);
        if (!matchKeyword) return false;
      }
      // 分类筛选
      if (filterCategory !== 'all' && tx.category?.id !== filterCategory) return false;
      // 成员筛选
      if (filterMember !== 'all' && tx.userId !== filterMember) return false;
      // 类型筛选
      if (filterType !== 'all' && tx.type !== filterType) return false;
      return true;
    });
  }, [allTransactions, keyword, filterCategory, filterMember, filterType]);

  // 分页数据
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const pagedTransactions = filteredTransactions.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  // 全选当前页
  const isAllSelected = pagedTransactions.length > 0 && pagedTransactions.every((tx) => selectedIds.has(tx.id));

  const handleSelectAll = () => {
    if (isAllSelected) {
      // 取消当前页全选
      const newSet = new Set(selectedIds);
      pagedTransactions.forEach((tx) => newSet.delete(tx.id));
      setSelectedIds(newSet);
    } else {
      // 选中当前页全部
      const newSet = new Set(selectedIds);
      pagedTransactions.forEach((tx) => newSet.add(tx.id));
      setSelectedIds(newSet);
    }
  };

  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleClearSelection = () => setSelectedIds(new Set());

  const handleBatchDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    // 实际调用API删除
    setSelectedIds(new Set());
  };

  const handleBatchClassify = () => {
    // 打开分类选择弹窗
  };

  // 汇总信息
  const totalExpense = filteredTransactions
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalIncome = filteredTransactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="page-container">
      {/* 标题栏 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">交易管理</h1>
          <p className="text-text-secondary mt-1">
            共 {filteredTransactions.length} 条记录 ·
            收入 <span className="text-income font-medium">{formatCurrency(totalIncome)}</span> ·
            支出 <span className="text-expense font-medium">{formatCurrency(totalExpense)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download size={14} />
            导出
          </Button>
          <Button size="sm" onClick={() => setQuickRecordOpen(true)}>
            <ArrowLeftRight size={14} />
            快速记账
          </Button>
        </div>
      </div>

      {/* 筛选栏 */}
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* 搜索 */}
          <div className="relative md:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索商户、备注、分类..."
              className="pl-9"
            />
          </div>

          {/* 分类筛选 */}
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger>
              <SelectValue placeholder="全部分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分类</SelectItem>
              {DEFAULT_EXPENSE_CATEGORIES.map((cat) => (
                <SelectItem key={cat.name} value={cat.name}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 成员筛选 */}
          <Select value={filterMember} onValueChange={setFilterMember}>
            <SelectTrigger>
              <SelectValue placeholder="全部成员" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部成员</SelectItem>
              <SelectItem value="u1">我</SelectItem>
              <SelectItem value="u2">伴侣</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 第二行筛选 */}
        <div className="flex items-center gap-3 mt-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-32">
              <Filter size={14} className="mr-1" />
              <SelectValue placeholder="类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="expense">支出</SelectItem>
              <SelectItem value="income">收入</SelectItem>
            </SelectContent>
          </Select>

          <input
            type="date"
            className="h-10 px-3 text-sm bg-surface border border-border rounded-lg outline-none focus:border-primary"
          />
          <span className="text-text-tertiary">—</span>
          <input
            type="date"
            className="h-10 px-3 text-sm bg-surface border border-border rounded-lg outline-none focus:border-primary"
          />

          {(keyword || filterCategory !== 'all' || filterMember !== 'all' || filterType !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setKeyword('');
                setFilterCategory('all');
                setFilterMember('all');
                setFilterType('all');
              }}
              className="text-text-secondary"
            >
              清除筛选
            </Button>
          )}
        </div>
      </Card>

      {/* 批量操作栏 */}
      <div className="mb-3">
        <BatchOperations
          selectedCount={selectedIds.size}
          onBatchDelete={handleBatchDelete}
          onBatchClassify={handleBatchClassify}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          isAllSelected={isAllSelected}
        />
      </div>

      {/* 交易表格 */}
      <Card className="overflow-hidden">
        {pagedTransactions.length === 0 ? (
          <EmptyState
            icon={<ArrowLeftRight size={48} />}
            title="暂无交易记录"
            description="按 Ctrl+K 快速记账，或导入账单开始管理你的财务"
            action={
              <Button onClick={() => setQuickRecordOpen(true)}>
                快速记账
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                  />
                </TableHead>
                <TableHead>日期</TableHead>
                <TableHead>商户/备注</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>成员</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead>来源</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedTransactions.map((tx) => (
                <TableRow
                  key={tx.id}
                  data-state={selectedIds.has(tx.id) ? 'selected' : undefined}
                  className="cursor-pointer"
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(tx.id)}
                      onChange={() => handleSelectOne(tx.id)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                    />
                  </TableCell>
                  <TableCell className="text-text-secondary whitespace-nowrap">
                    {formatDate(tx.date, 'MM-dd HH:mm')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="text-sm font-medium text-text-primary">
                          {tx.merchant || '未命名'}
                        </div>
                        {tx.note && (
                          <div className="text-xs text-text-tertiary">{tx.note}</div>
                        )}
                      </div>
                      {tx.isLargeExpense && (
                        <Badge variant="destructive" className="shrink-0">大额</Badge>
                      )}
                      {tx.aiCorrected && (
                        <Badge variant="outline" className="shrink-0 text-xs">已纠正</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <CategoryTag category={tx.category} />
                  </TableCell>
                  <TableCell className="text-text-secondary">
                    {tx.user?.nickname || '未知'}
                  </TableCell>
                  <TableCell className="text-right">
                    <AmountText amount={tx.amount} type={tx.type} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={tx.source === 'quick_record' ? 'default' : 'outline'} className="text-xs">
                      {tx.source === 'quick_record' ? '快捷' : tx.source === 'import' ? '导入' : '手动'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* 分页 */}
      {filteredTransactions.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-text-tertiary">
            第 {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filteredTransactions.length)} 条，
            共 {filteredTransactions.length} 条
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              <ChevronLeft size={14} />
              上一页
            </Button>
            <span className="text-sm text-text-secondary px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
            >
              下一页
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* 批量删除确认弹窗 */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="确认批量删除"
        description={`将删除 ${selectedIds.size} 条交易记录，此操作不可撤销。`}
        confirmText="确认删除"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, Download, ChevronLeft, ChevronRight, ArrowLeftRight, Pencil } from 'lucide-react';
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
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { DEFAULT_EXPENSE_CATEGORIES } from '@/lib/categories';
import { getTransactions, batchDeleteTransactions } from '@/services/transaction.service';
import { EditTransactionModal } from './EditTransactionModal';
import type { Transaction, TransactionQueryParams } from '@/types/transaction';

/**
 * 交易列表页面
 * 包含：筛选栏（日期/分类/成员/金额）、表格、批量选择、编辑弹窗、分页
 */
export function TransactionListPage() {
  const queryClient = useQueryClient();
  const { setQuickRecordOpen } = useUIStore();
  const { user } = useAuthStore();

  // 筛选状态
  const [keyword, setKeyword] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMember, setFilterMember] = useState('all');
  const [filterType, setFilterType] = useState('all');
  // 退款/报销状态筛选
  const [filterRefund, setFilterRefund] = useState('all');
  const [filterReimburse, setFilterReimburse] = useState('all');
  // 待报销 Tab
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');

  // 分页状态
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 批量选择状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 编辑弹窗状态
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // 组装查询参数：待报销Tab / 报销状态下拉 / 退款状态下拉 直接走后端 QueryTransactionDto
  // （后端已支持 refundStatus / reimbursementStatus 过滤，见 backend query-transaction.dto.ts）
  const queryParams = useMemo<TransactionQueryParams>(() => {
    const params: TransactionQueryParams = { page, pageSize };
    if (activeTab === 'pending') {
      // 待报销 Tab：强制报销状态 = PENDING
      params.reimbursementStatus = 'PENDING';
    } else if (filterReimburse !== 'all') {
      params.reimbursementStatus = filterReimburse as TransactionQueryParams['reimbursementStatus'];
    }
    if (filterRefund !== 'all') {
      params.refundStatus = filterRefund as TransactionQueryParams['refundStatus'];
    }
    return params;
  }, [page, pageSize, activeTab, filterReimburse, filterRefund]);

  // TanStack Query：获取交易列表
  const { data: queryResult, isLoading, isError, error } = useQuery({
    queryKey: ['transactions', queryParams],
    queryFn: () => getTransactions(queryParams),
  });

  // 批量删除
  const batchDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => batchDeleteTransactions(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });

  const allTransactions = queryResult?.items || [];

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

  // 分页数据（基于过滤后的数据前端分页）
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const pagedTransactions = filteredTransactions.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  // 全选当前页
  const isAllSelected = pagedTransactions.length > 0 && pagedTransactions.every((tx) => selectedIds.has(tx.id));

  const handleSelectAll = () => {
    if (isAllSelected) {
      const newSet = new Set(selectedIds);
      pagedTransactions.forEach((tx) => newSet.delete(tx.id));
      setSelectedIds(newSet);
    } else {
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
    batchDeleteMutation.mutate(Array.from(selectedIds));
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
  };

  const handleBatchClassify = () => {
    // 打开分类选择弹窗（后续实现）
  };

  // 打开编辑弹窗
  const handleEdit = (tx: Transaction) => {
    setEditTransaction(tx);
    setEditDialogOpen(true);
  };

  // 编辑完成后刷新列表
  const handleEditSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  }, [queryClient]);

  // 汇总信息
  const totalExpense = filteredTransactions
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalIncome = filteredTransactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (isError) {
    return (
      <div className="page-container">
        <div className="flex flex-col items-center justify-center min-h-[40vh]">
          <p className="text-expense font-medium text-lg">加载交易数据失败</p>
          <p className="text-text-secondary mt-2">{(error as Error)?.message || '请检查网络连接'}</p>
          <Button className="mt-4" onClick={() => queryClient.invalidateQueries({ queryKey: ['transactions'] })}>
            重试
          </Button>
        </div>
      </div>
    );
  }

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

      {/* 待报销 / 全部 Tab */}
      <div className="flex items-center gap-1 mb-4 bg-surface border border-border rounded-lg p-1 w-fit">
        <button
          onClick={() => { setActiveTab('all'); setPage(1); }}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            activeTab === 'all' ? 'bg-primary text-white' : 'text-text-secondary hover:text-primary',
          )}
        >
          全部
        </button>
        <button
          onClick={() => { setActiveTab('pending'); setPage(1); }}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
            activeTab === 'pending' ? 'bg-primary text-white' : 'text-text-secondary hover:text-primary',
          )}
        >
          待报销
        </button>
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
              <SelectItem value={user?.id || 'u1'}>{user?.nickname || '我'}</SelectItem>
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

          {/* 报销状态筛选（走后端 reimbursementStatus） */}
          <Select value={filterReimburse} onValueChange={(v) => { setFilterReimburse(v); setPage(1); }}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="报销状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">报销状态</SelectItem>
              <SelectItem value="NONE">未报销</SelectItem>
              <SelectItem value="PENDING">待报销</SelectItem>
              <SelectItem value="REIMBURSED">已报销</SelectItem>
            </SelectContent>
          </Select>

          {/* 退款状态筛选（走后端 refundStatus） */}
          <Select value={filterRefund} onValueChange={(v) => { setFilterRefund(v); setPage(1); }}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="退款状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">退款状态</SelectItem>
              <SelectItem value="NONE">未退款</SelectItem>
              <SelectItem value="PARTIAL">部分退款</SelectItem>
              <SelectItem value="FULL">已退款</SelectItem>
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

          {(keyword || filterCategory !== 'all' || filterMember !== 'all' || filterType !== 'all' || filterReimburse !== 'all' || filterRefund !== 'all' || activeTab !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setKeyword('');
                setFilterCategory('all');
                setFilterMember('all');
                setFilterType('all');
                setFilterReimburse('all');
                setFilterRefund('all');
                setActiveTab('all');
                setPage(1);
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
            description="按 Ctrl+K 快速记账，开始管理你的财务"
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
                <TableHead className="w-16">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedTransactions.map((tx) => (
                <TableRow
                  key={tx.id}
                  data-state={selectedIds.has(tx.id) ? 'selected' : undefined}
                  className="cursor-pointer"
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(tx.id)}
                      onChange={() => handleSelectOne(tx.id)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                    />
                  </TableCell>
                  <TableCell
                    className="text-text-secondary whitespace-nowrap"
                    onClick={() => handleEdit(tx)}
                  >
                    {formatDate(tx.date, 'MM-dd HH:mm')}
                  </TableCell>
                  <TableCell onClick={() => handleEdit(tx)}>
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
                  <TableCell onClick={() => handleEdit(tx)}>
                    <CategoryTag category={tx.category} />
                  </TableCell>
                  <TableCell
                    className="text-text-secondary"
                    onClick={() => handleEdit(tx)}
                  >
                    {tx.user?.nickname || '未知'}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    onClick={() => handleEdit(tx)}
                  >
                    <AmountText amount={tx.amount} type={tx.type} />
                  </TableCell>
                  <TableCell onClick={() => handleEdit(tx)}>
                    <Badge variant={tx.source === 'quick_record' ? 'default' : 'outline'} className="text-xs">
                      {tx.source === 'quick_record' ? '快捷' : tx.source === 'import' ? '导入' : '手动'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(tx);
                      }}
                      className="text-text-secondary hover:text-primary"
                    >
                      <Pencil size={14} />
                    </Button>
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

      {/* 编辑交易弹窗 */}
      <EditTransactionModal
        transaction={editTransaction}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSaved={handleEditSaved}
      />
    </div>
  );
}

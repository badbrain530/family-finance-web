import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Smartphone,
  CreditCard,
  Building,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/toaster';
import { cn, formatDate, formatPercentage } from '@/lib/utils';
import { ImportPlatform, ImportStatus } from '@/types/import';

/**
 * 账单导入页面
 * 拖拽上传区域 + 平台选择 + 导入历史表格
 */

// 平台配置
const PLATFORMS = [
  { id: ImportPlatform.ALIPAY, name: '支付宝', icon: Smartphone, color: '#1677FF', desc: '支持CSV/HTML账单' },
  { id: ImportPlatform.WECHAT, name: '微信', icon: Smartphone, color: '#07C160', desc: '支持CSV账单' },
  { id: ImportPlatform.CMB, name: '招商银行', icon: CreditCard, color: '#C7000B', desc: '支持PDF账单' },
  { id: ImportPlatform.ICBC, name: '工商银行', icon: Building, color: '#C7000B', desc: '支持PDF账单' },
  { id: ImportPlatform.CCB, name: '建设银行', icon: Building, color: '#0066B3', desc: '支持PDF账单' },
];

// 状态配置
const STATUS_CONFIG: Record<ImportStatus, { label: string; variant: 'default' | 'success' | 'destructive' | 'warning' | 'outline'; icon: typeof CheckCircle }> = {
  [ImportStatus.PENDING]: { label: '等待中', variant: 'outline', icon: Clock },
  [ImportStatus.PARSING]: { label: '解析中', variant: 'warning', icon: Loader2 },
  [ImportStatus.PREVIEW]: { label: '待确认', variant: 'default', icon: Clock },
  [ImportStatus.CONFIRMED]: { label: '已导入', variant: 'success', icon: CheckCircle },
  [ImportStatus.FAILED]: { label: '失败', variant: 'destructive', icon: XCircle },
};

export function ImportPage() {
  const { toast } = useToast();
  const [selectedPlatform, setSelectedPlatform] = useState<ImportPlatform>(ImportPlatform.ALIPAY);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  // TanStack Query 获取导入历史
  const { data: importHistory } = useQuery({
    queryKey: ['imports'],
    queryFn: async () => {
      // TODO: 接入真实 API
      return [];
    },
  });

  // 暂用常量（后续移除）
  const mockHistory = [
    { id: 'imp1', platform: ImportPlatform.ALIPAY, fileName: 'alipay_bill_202606.csv', totalCount: 156, successCount: 152, failedCount: 4, aiAccuracy: 0.94, status: ImportStatus.CONFIRMED, createdAt: '2026-07-01T10:30:00Z' },
    { id: 'imp2', platform: ImportPlatform.WECHAT, fileName: 'wechat_bill_202606.csv', totalCount: 89, successCount: 89, failedCount: 0, aiAccuracy: 0.97, status: ImportStatus.CONFIRMED, createdAt: '2026-07-01T11:00:00Z' },
    { id: 'imp3', platform: ImportPlatform.CMB, fileName: 'cmb_credit_202606.pdf', totalCount: 0, successCount: 0, failedCount: 0, aiAccuracy: null, status: ImportStatus.FAILED, createdAt: '2026-06-28T15:00:00Z' },
  ];

  const history = importHistory || mockHistory;

  // 拖拽处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleUpload = (file: File) => {
    // 验证文件类型
    const allowedTypes = ['.csv', '.html', '.htm', '.pdf'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(ext)) {
      toast({
        title: '文件格式不支持',
        description: '请上传 CSV、HTML 或 PDF 文件',
        variant: 'destructive',
      });
      return;
    }

    // 验证文件大小（最大10MB）
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: '文件过大',
        description: '文件大小不能超过10MB',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    // 模拟上传
    setTimeout(() => {
      setUploading(false);
      toast({
        title: '上传成功',
        description: `正在解析 ${file.name}，稍后将显示预览`,
        variant: 'success',
      });
    }, 1500);
  };

  return (
    <div className="page-container">
      {/* 标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">账单导入</h1>
        <p className="text-text-secondary mt-1">导入支付宝、微信或银行账单，AI自动分类</p>
      </div>

      {/* 平台选择 */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">选择账单来源</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {PLATFORMS.map((platform) => {
              const Icon = platform.icon;
              const isSelected = selectedPlatform === platform.id;
              return (
                <button
                  key={platform.id}
                  onClick={() => setSelectedPlatform(platform.id)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all',
                    isSelected
                      ? 'border-primary bg-primary-50'
                      : 'border-border hover:border-primary-200',
                  )}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: platform.color + '20' }}
                  >
                    <Icon size={20} style={{ color: platform.color }} />
                  </div>
                  <span className="text-sm font-medium text-text-primary">{platform.name}</span>
                  <span className="text-xs text-text-tertiary">{platform.desc}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 拖拽上传区 */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'flex flex-col items-center justify-center py-12 px-6 rounded-xl border-2 border-dashed transition-all cursor-pointer',
              isDragging
                ? 'border-primary bg-primary-50'
                : 'border-border hover:border-primary-300 hover:bg-primary-50/30',
            )}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            {uploading ? (
              <>
                <Loader2 size={40} className="text-primary animate-spin mb-3" />
                <p className="text-sm font-medium text-text-primary">上传中...</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-primary-50 flex items-center justify-center mb-3">
                  <Upload size={28} className="text-primary" />
                </div>
                <p className="text-base font-medium text-text-primary mb-1">
                  拖拽文件到此处，或点击选择文件
                </p>
                <p className="text-sm text-text-tertiary">
                  支持 CSV / HTML / PDF 格式，最大 10MB
                </p>
                <input
                  id="file-input"
                  type="file"
                  className="hidden"
                  accept=".csv,.html,.htm,.pdf"
                  onChange={handleFileSelect}
                />
              </>
            )}
          </div>

          {/* 导入说明 */}
          <div className="mt-4 p-3 rounded-lg bg-primary-50/50 border border-primary-100">
            <p className="text-sm text-text-secondary">
              💡 提示：导入后AI将自动分类交易，低置信度的交易会高亮标记，你可以批量修改分类后确认导入。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 导入历史 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">导入历史</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>文件名</TableHead>
                <TableHead>平台</TableHead>
                <TableHead className="text-right">总条数</TableHead>
                <TableHead className="text-right">成功</TableHead>
                <TableHead className="text-right">失败</TableHead>
                <TableHead className="text-right">AI准确率</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((record: any) => {
                const status = STATUS_CONFIG[record.status as ImportStatus];
                const StatusIcon = status.icon;
                const platform = PLATFORMS.find((p) => p.id === record.platform);
                return (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-text-tertiary shrink-0" />
                        <span className="text-sm text-text-primary truncate max-w-40">
                          {record.fileName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-text-secondary">{platform?.name || record.platform}</span>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">{record.totalCount}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-income">{record.successCount}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-expense">{record.failedCount}</TableCell>
                    <TableCell className="text-right">
                      {record.aiAccuracy !== null ? (
                        <span className="text-sm font-medium text-text-primary tabular-nums">
                          {formatPercentage(record.aiAccuracy)}
                        </span>
                      ) : (
                        <span className="text-sm text-text-tertiary">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className="text-xs">
                        <StatusIcon size={12} className={record.status === ImportStatus.PARSING ? 'animate-spin' : ''} />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-text-tertiary whitespace-nowrap">
                      {formatDate(record.createdAt, 'MM-dd HH:mm')}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

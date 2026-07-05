import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * 页面容器组件
 * 统一页面布局：标题 + 描述 + 操作区 + 内容区
 */
export function PageContainer({ title, description, actions, children, className }: PageContainerProps) {
  return (
    <div className={cn('page-container', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between mb-6">
          <div>
            {title && <h1 className="text-2xl font-bold text-text-primary">{title}</h1>}
            {description && <p className="text-text-secondary mt-1">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

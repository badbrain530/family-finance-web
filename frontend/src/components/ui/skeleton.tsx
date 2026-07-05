import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * 骨架屏组件 (shadcn/ui)
 * 用于数据加载时的占位
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-primary-50/60', className)}
      {...props}
    />
  );
}

export { Skeleton };

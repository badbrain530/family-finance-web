import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Toast通知组件 (shadcn/ui)
 */

const ToastProvider = ToastPrimitive.Provider;

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-center justify-between space-x-3 overflow-hidden rounded-lg border p-4 pr-6 shadow-lg transition-all',
  {
    variants: {
      variant: {
        default: 'border-border bg-surface text-text-primary',
        success: 'border-income/20 bg-income/5 text-text-primary',
        destructive: 'border-expense/20 bg-expense/5 text-text-primary',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      'fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4',
      'sm:bottom-0 sm:right-0 sm:top-auto sm:max-w-sm',
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitive.Viewport.displayName;

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn(toastVariants({ variant }), 'data-[state=open]:animate-slide-up', className)}
    {...props}
  />
));
Toast.displayName = ToastPrimitive.Root.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    className={cn(
      'absolute right-1.5 top-1.5 rounded-md p-1 text-text-tertiary opacity-70 transition-opacity',
      'hover:opacity-100 hover:bg-primary-50',
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitive.Close>
));
ToastClose.displayName = ToastPrimitive.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title ref={ref} className={cn('text-sm font-semibold', className)} {...props} />
));
ToastTitle.displayName = ToastPrimitive.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description ref={ref} className={cn('text-sm text-text-secondary', className)} {...props} />
));
ToastDescription.displayName = ToastPrimitive.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

export {
  type ToastProps,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
};

// ==================== useToast Hook ====================

export type ToastVariant = 'default' | 'success' | 'destructive';

export interface ToastData {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

let toastCount = 0;

/** 全局Toast设置器 */
let globalSetToasts: React.Dispatch<React.SetStateAction<ToastData[]>> | null = null;

/** 注册全局Toast设置器 */
export function registerToastSetter(setter: React.Dispatch<React.SetStateAction<ToastData[]>>) {
  globalSetToasts = setter;
}

/** Toast hook，提供显示toast的方法 */
export function useToast() {
  const show = (data: Omit<ToastData, 'id'>) => {
    const id = `toast-${++toastCount}`;
    const toast: ToastData = {
      id,
      duration: 3000,
      variant: 'default',
      ...data,
    };

    if (globalSetToasts) {
      globalSetToasts((prev) => [...prev, toast]);
    }

    // 自动移除
    if (toast.duration && toast.duration > 0) {
      setTimeout(() => {
        if (globalSetToasts) {
          globalSetToasts((prev) => prev.filter((t) => t.id !== id));
        }
      }, toast.duration);
    }
  };

  const dismiss = (id: string) => {
    if (globalSetToasts) {
      globalSetToasts((prev) => prev.filter((t) => t.id !== id));
    }
  };

  return { toast: show, dismiss };
}

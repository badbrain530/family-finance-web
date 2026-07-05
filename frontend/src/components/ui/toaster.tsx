import * as React from 'react';
import { useToast, ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose, registerToastSetter } from './toast';

/**
 * Toaster - 全局Toast渲染组件
 * 挂载在应用根节点，负责渲染所有Toast
 */
export function Toaster() {
  const [toasts, setToasts] = React.useState<import('./toast').ToastData[]>([]);

  // 注册全局设置器
  React.useEffect(() => {
    registerToastSetter(setToasts);
    return () => registerToastSetter(() => {});
  }, []);

  return (
    <ToastProvider>
      {toasts.map((toast) => (
        <Toast key={toast.id} variant={toast.variant}>
          <div className="flex-1">
            {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
            {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}

export { useToast };

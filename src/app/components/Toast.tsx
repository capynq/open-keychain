import type { ReactNode } from 'react';

export type ToastVariant = 'success' | 'manual' | 'error';

export const Toast = ({ variant, children }: { variant: ToastVariant; children: ReactNode }) => {
  const isError = variant === 'error';

  return (
    <div
      className={`toast toast-${variant}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {children}
    </div>
  );
};

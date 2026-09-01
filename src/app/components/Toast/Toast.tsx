import type { ReactNode } from 'react';

import styles from './Toast.module.css';

export type ToastVariant = 'success' | 'manual' | 'error';

export const Toast = ({ variant, children }: { variant: ToastVariant; children: ReactNode }) => {
  const isError = variant === 'error';

  return (
    <div
      className={`${styles.root} toast toast-${variant}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      {children}
    </div>
  );
};

import type { ReactNode } from 'react';

import styles from './Toast.module.css';

export type ToastVariant = 'success' | 'manual' | 'error';

export const Toast = ({
  variant,
  children,
  announce = true,
}: {
  variant: ToastVariant;
  children: ReactNode;
  announce?: boolean;
}) => {
  const isError = variant === 'error';

  return (
    <div
      className={`${styles.root} toast toast-${variant}`}
      role={announce ? (isError ? 'alert' : 'status') : undefined}
      aria-live={announce ? (isError ? 'assertive' : 'polite') : undefined}
      aria-atomic={announce ? true : undefined}
    >
      {children}
    </div>
  );
};

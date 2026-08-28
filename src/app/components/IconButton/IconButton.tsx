import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import styles from './IconButton.module.css';

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children' | 'title'
> & {
  action?: string;
  busy?: boolean;
  icon: LucideIcon;
  label: string;
};

/** Shared icon action with an accessible label and stable behavior hooks. */
export const IconButton = ({
  action,
  busy = false,
  className,
  icon: Icon,
  label,
  ...buttonProps
}: IconButtonProps) => (
  <button
    {...buttonProps}
    type={buttonProps.type ?? 'button'}
    className={[styles.root, 'icon-button', className].filter(Boolean).join(' ')}
    aria-label={label}
    aria-busy={busy || undefined}
    title={label}
    data-icon-button="true"
    data-icon-action={action}
    data-tooltip={label}
  >
    <Icon aria-hidden="true" focusable="false" size={19} strokeWidth={2} />
  </button>
);

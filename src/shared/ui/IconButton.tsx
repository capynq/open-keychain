import type { LucideIcon } from 'lucide-react';
import type { ComponentPropsWithRef } from 'react';

import styles from './IconButton.module.css';

export type IconButtonProps = Omit<
  ComponentPropsWithRef<'button'>,
  'aria-label' | 'children' | 'title'
> & {
  action?: string;
  busy?: boolean;
  icon: LucideIcon;
  iconSize?: number;
  label: string;
  motion?: 'none' | 'nudge' | 'rotate' | 'scale';
  showLabel?: boolean;
};

/** Shared icon action with an accessible label and stable behavior hooks. */
export const IconButton = ({
  action,
  busy = false,
  className,
  icon: Icon,
  iconSize = 19,
  label,
  motion = 'none',
  showLabel = false,
  ...buttonProps
}: IconButtonProps) => (
  <button
    {...buttonProps}
    type={buttonProps.type ?? 'button'}
    className={[styles.root, showLabel && styles.withLabel, 'icon-button', className]
      .filter(Boolean)
      .join(' ')}
    aria-label={label}
    aria-busy={busy || undefined}
    title={label}
    data-icon-button="true"
    data-icon-action={action}
    data-icon-motion={motion}
    data-tooltip={label}
  >
    <Icon aria-hidden="true" focusable="false" size={iconSize} strokeWidth={2} />
    {showLabel && <span className={styles.label}>{label}</span>}
  </button>
);

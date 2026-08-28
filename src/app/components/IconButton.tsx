import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children' | 'title'
> & {
  action?: string;
  busy?: boolean;
  icon: LucideIcon;
  label: string;
};

/**
 * Shared compact action button. The visible icon is decorative; the localized
 * label remains the control's accessible name and tooltip.
 */
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
    className={['icon-button', className].filter(Boolean).join(' ')}
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

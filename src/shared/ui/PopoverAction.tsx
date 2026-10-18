import type { LucideIcon } from 'lucide-react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

import styles from './PopoverAction.module.css';

type CommonProps = {
  icon?: LucideIcon;
  leading?: ReactNode;
  label: string;
  detail?: string;
  selected?: boolean;
  busy?: boolean;
};
export type PopoverActionProps = CommonProps &
  (
    | ({ kind: 'button'; href?: never } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>)
    | ({ kind: 'link'; href: string; disabled?: never } & Omit<
        AnchorHTMLAttributes<HTMLAnchorElement>,
        'children'
      >)
  );

export const PopoverAction = (props: PopoverActionProps) => {
  const { icon: Icon, leading, label, detail, selected, busy, className, ...rest } = props;
  const content = (
    <>
      {(leading || Icon) && (
        <span className={styles.leading} data-icon-motion="scale">
          {leading ?? (Icon && <Icon aria-hidden="true" size={20} />)}
        </span>
      )}
      <span className={styles.label}>{label}</span>
      {detail && <span className={styles.detail}>{detail}</span>}
    </>
  );
  const classes = [styles.root, selected && styles.selected, className].filter(Boolean).join(' ');

  if (rest.kind === 'link') {
    const { kind, ...linkProps } = rest;

    return (
      <a
        {...linkProps}
        className={classes}
        data-popover-action={kind}
        aria-busy={busy || undefined}
      >
        {content}
      </a>
    );
  }

  const { kind, ...buttonProps } = rest;

  return (
    <button
      {...buttonProps}
      type={buttonProps.type ?? 'button'}
      className={classes}
      data-popover-action={kind}
      aria-busy={busy || undefined}
    >
      {content}
    </button>
  );
};

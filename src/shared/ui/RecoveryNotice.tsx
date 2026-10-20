import { Wrench } from 'lucide-react';

import { PopoverAction } from './PopoverAction';
import styles from './RecoveryNotice.module.css';

export type RecoveryNoticeAction = {
  id: string;
  label: string;
  onAction: () => void | Promise<void>;
  disabled?: boolean;
  busy?: boolean;
};

/** Domain-free recovery content: callers own permissions, validation and operation state. */
export const RecoveryNotice = ({
  message,
  actions,
  diagnostic,
  detailsLabel,
  steps,
  className,
  role,
}: {
  message: string;
  actions: readonly RecoveryNoticeAction[];
  diagnostic?: string;
  detailsLabel: string;
  steps?: string;
  className?: string;
  role?: 'alert' | 'status';
}) => (
  <div className={[styles.root, className].filter(Boolean).join(' ')} data-recovery-notice>
    <p className={styles.message} role={role} aria-atomic={role ? true : undefined}>
      {message}
    </p>
    {steps && <p className={styles.steps}>{steps}</p>}
    {actions.length > 0 && (
      <div className={styles.actions}>
        {actions.map((action) => (
          <PopoverAction
            key={action.id}
            kind="button"
            icon={Wrench}
            label={action.label}
            disabled={action.disabled}
            busy={action.busy}
            onClick={() => {
              void action.onAction();
            }}
          />
        ))}
      </div>
    )}
    {diagnostic && (
      <details>
        <summary>{detailsLabel}</summary>
        <code>{diagnostic}</code>
      </details>
    )}
  </div>
);

import { ClipboardCopy, Mail, Wrench } from 'lucide-react';
import { useState } from 'react';

import { copyTextToClipboard } from '../lib/clipboard';
import { PopoverAction } from './PopoverAction';
import styles from './RecoveryNotice.module.css';

export type RecoveryNoticeAction = {
  id: string;
  label: string;
  onAction: () => void | Promise<void>;
  disabled?: boolean;
  busy?: boolean;
};

/**
 * One-click support report: a prefilled email plus a copy fallback for webmail users.
 * `build` runs when the visitor reaches for an action, so the report carries the current time
 * and error log; `href` is only the fallback before that.
 */
export type RecoveryNoticeReport = {
  href: string;
  build: () => { href: string; text: string };
  emailLabel: string;
  copyLabel: string;
  copiedLabel: string;
  copyFailedLabel: string;
  onOpen?: (channel: 'email' | 'copy') => void;
};

const SupportReportActions = ({ report }: { report: RecoveryNoticeReport }) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const refreshHref = (link: HTMLAnchorElement): void => {
    link.href = report.build().href;
  };

  return (
    <div className={styles.report} data-support-report>
      <PopoverAction
        kind="link"
        icon={Mail}
        href={report.href}
        label={report.emailLabel}
        onPointerEnter={(event) => refreshHref(event.currentTarget)}
        onFocus={(event) => refreshHref(event.currentTarget)}
        onClick={(event) => {
          refreshHref(event.currentTarget);
          report.onOpen?.('email');
        }}
      />
      <PopoverAction
        kind="button"
        icon={ClipboardCopy}
        label={report.copyLabel}
        onClick={() => {
          report.onOpen?.('copy');
          void copyTextToClipboard(report.build().text).then((copied) =>
            setCopyStatus(copied ? 'copied' : 'failed'),
          );
        }}
      />
      <span className={styles.copyStatus} role="status" aria-live="polite">
        {copyStatus === 'copied'
          ? report.copiedLabel
          : copyStatus === 'failed'
            ? report.copyFailedLabel
            : ''}
      </span>
    </div>
  );
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
  report,
}: {
  message: string;
  actions: readonly RecoveryNoticeAction[];
  diagnostic?: string;
  detailsLabel: string;
  steps?: string;
  className?: string;
  role?: 'alert' | 'status';
  report?: RecoveryNoticeReport;
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
    {report && <SupportReportActions report={report} />}
    {diagnostic && (
      <details>
        <summary>{detailsLabel}</summary>
        <code>{diagnostic}</code>
      </details>
    )}
  </div>
);

import { CircleCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { IconButton } from './IconButton';
import styles from './NotificationToast.module.css';

type NotificationToastProps = {
  title: string;
  description: string;
  dismissLabel: string;
  onDismiss: () => void;
};

const TOAST_EXIT_MS = 150;

/** Transient confirmation; never moves focus and pauses dismissal during interaction. */
export const NotificationToast = ({
  title,
  description,
  dismissLabel,
  onDismiss,
}: NotificationToastProps) => {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (hovered || focused || leaving) return;

    const timeout = window.setTimeout(() => setLeaving(true), 6000 - TOAST_EXIT_MS);

    return () => window.clearTimeout(timeout);
  }, [focused, hovered, leaving]);

  useEffect(() => {
    if (!leaving) return;

    const timeout = window.setTimeout(onDismiss, TOAST_EXIT_MS);

    return () => window.clearTimeout(timeout);
  }, [leaving, onDismiss]);

  return createPortal(
    <div className={styles.positioner} data-notification-toast="true">
      <div
        className={styles.root}
        data-leaving={leaving ? 'true' : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
        }}
      >
        <span className={styles.icon} aria-hidden="true">
          <CircleCheck size={24} />
        </span>
        <div className={styles.message} role="status" aria-atomic="true">
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <IconButton icon={X} label={dismissLabel} onClick={() => setLeaving(true)} motion="none" />
      </div>
    </div>,
    document.body,
  );
};

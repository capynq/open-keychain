import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

import { t, type Locale } from '@/infrastructure/i18n';
import { IconButton } from '@/shared/ui/IconButton';

import styles from './FontChooserDialog.module.css';

export const FontChooserDialog = ({
  locale,
  open,
  busy,
  onClose,
  children,
}: {
  locale: Locale;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) => {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-busy={busy}
      data-testid="font-chooser-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (busy || event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <header className={styles.header}>
        <h2 id={titleId}>{t(locale, 'simpleChooseFont')}</h2>
        <IconButton
          icon={X}
          label={t(locale, 'close')}
          motion="none"
          disabled={busy}
          onClick={onClose}
        />
      </header>
      <div className={`${styles.body} controls-panel`}>
        <fieldset className={styles.content} disabled={busy}>
          {open ? children : null}
        </fieldset>
      </div>
    </dialog>
  );
};

import { useEffect, useRef, useState } from 'react';

import { ResetIconButton } from '@/shared/ui/ResetIconButton';

import type { SurfacePresetId } from '../../../features/preview';

import { t, type Locale } from '../../../infrastructure/i18n';

const SURFACE_PRESETS: readonly SurfacePresetId[] = ['matte', 'graph', 'dark', 'wood', 'metal'];

export const SurfacePopover = ({
  locale,
  surfacePreset,
  onSurfaceChange,
  onReset,
}: {
  locale: Locale;
  surfacePreset: SurfacePresetId;
  onSurfaceChange: (preset: SurfacePresetId) => void;
  onReset: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    const closeOnOutsidePointer = (event: PointerEvent): void => {
      if (!popoverRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [open]);

  return (
    <div className="surface-popover" ref={popoverRef}>
      <button
        type="button"
        className="surface-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="surface-menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span className={`surface-dot surface-dot-${surfacePreset}`} aria-hidden="true" />
        <span>{t(locale, surfacePreset)}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m7 9 5 5 5-5" />
        </svg>
      </button>
      {open && (
        <div
          className="surface-menu"
          id="surface-menu"
          role="dialog"
          aria-label={t(locale, 'surface')}
        >
          <div className="surface-menu-heading">
            <span>{t(locale, 'surface')}</span>
            <ResetIconButton
              label={t(locale, 'resetSurface')}
              onClick={() => {
                onReset();
                setOpen(false);
              }}
            />
          </div>
          <div className="surface-options">
            {SURFACE_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset}
                className={surfacePreset === preset ? 'selected' : ''}
                aria-pressed={surfacePreset === preset}
                onClick={() => {
                  onSurfaceChange(preset);
                  setOpen(false);
                }}
              >
                <span className={`surface-dot surface-dot-${preset}`} aria-hidden="true" />
                <span>{t(locale, preset)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

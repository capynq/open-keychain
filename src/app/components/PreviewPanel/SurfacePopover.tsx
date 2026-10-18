import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { AnchoredPopover } from '@/shared/ui/AnchoredPopover';
import { PopoverAction } from '@/shared/ui/PopoverAction';
import { ResetIconButton } from '@/shared/ui/ResetIconButton';

import type { SurfacePresetId } from '../../../features/preview/components/Viewer/Viewer';
import type { Locale } from '../../../infrastructure/i18n/config';

import { t } from '../../../infrastructure/i18n/utils';

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

  return (
    <div className="surface-popover">
      <AnchoredPopover
        open={open}
        onOpenChange={setOpen}
        label={t(locale, 'surface')}
        placement="bottom-end"
        trigger={(props) => (
          <button {...props} type="button" className="surface-trigger" data-icon-motion="rotate">
            <span className={`surface-dot surface-dot-${surfacePreset}`} aria-hidden="true" />
            <span>{t(locale, surfacePreset)}</span>
            <ChevronDown aria-hidden="true" />
          </button>
        )}
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
        <div className="surface-popover-options">
          {SURFACE_PRESETS.map((preset) => (
            <PopoverAction
              key={preset}
              kind="button"
              label={t(locale, preset)}
              selected={surfacePreset === preset}
              aria-pressed={surfacePreset === preset}
              onClick={() => {
                onSurfaceChange(preset);
                setOpen(false);
              }}
              leading={<span className={`surface-dot surface-dot-${preset}`} aria-hidden="true" />}
            />
          ))}
        </div>
      </AnchoredPopover>
    </div>
  );
};

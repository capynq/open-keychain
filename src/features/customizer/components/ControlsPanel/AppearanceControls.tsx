import { useId } from 'react';

import type { PrintAppearanceOverrides } from '@/domain/keychain/model/types';

import { t, type Locale } from '@/infrastructure/i18n';
import { ResetIconButton } from '@/shared/ui/ResetIconButton';

import styles from './AppearanceControls.module.css';

export const AppearanceControls = ({
  locale,
  appearanceOverrides,
  baseColor,
  reliefColor,
  onAppearanceChange,
}: {
  locale: Locale;
  appearanceOverrides: PrintAppearanceOverrides;
  baseColor: string;
  reliefColor: string;
  onAppearanceChange: (overrides: PrintAppearanceOverrides) => void;
}) => {
  const id = useId();
  const baseInputId = `sidebar-base-color-${id}`;
  const reliefInputId = `sidebar-relief-color-${id}`;

  return (
    <section className="control-section" data-control-group="appearance">
      <div className="section-heading">
        <h2>{t(locale, 'printColors')}</h2>
      </div>
      <div
        className={styles.controls}
        data-testid="sidebar-colors"
        role="group"
        aria-label={t(locale, 'printColors')}
      >
        <div className={styles.field} data-testid="sidebar-color-field">
          <label htmlFor={baseInputId}>{t(locale, 'baseColor')}</label>
          <input
            id={baseInputId}
            type="color"
            aria-label={t(locale, 'baseColor')}
            value={appearanceOverrides.base ?? baseColor}
            onChange={(event) =>
              onAppearanceChange({ ...appearanceOverrides, base: event.target.value })
            }
          />
          <code>{(appearanceOverrides.base ?? baseColor).toUpperCase()}</code>
          <ResetIconButton
            label={t(locale, 'resetBaseColor')}
            onClick={() => onAppearanceChange({ ...appearanceOverrides, base: undefined })}
          />
        </div>
        <div className={styles.field} data-testid="sidebar-color-field">
          <label htmlFor={reliefInputId}>{t(locale, 'secondaryColor')}</label>
          <input
            id={reliefInputId}
            type="color"
            aria-label={t(locale, 'secondaryColor')}
            value={appearanceOverrides.relief ?? reliefColor}
            onChange={(event) =>
              onAppearanceChange({ ...appearanceOverrides, relief: event.target.value })
            }
          />
          <code>{(appearanceOverrides.relief ?? reliefColor).toUpperCase()}</code>
          <ResetIconButton
            label={t(locale, 'resetSecondaryColor')}
            onClick={() => onAppearanceChange({ ...appearanceOverrides, relief: undefined })}
          />
        </div>
      </div>
    </section>
  );
};

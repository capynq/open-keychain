import type { PrintAppearanceOverrides } from '@/domain/keychain/model/types';

import { t, type Locale } from '@/infrastructure/i18n';
import { ColorControl } from '@/shared/ui/ColorControl';

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
        <ColorControl
          label={t(locale, 'baseColor')}
          value={appearanceOverrides.base ?? baseColor}
          fallback={baseColor}
          resetLabel={t(locale, 'resetBaseColor')}
          testId="sidebar-color-field"
          onChange={(value) => onAppearanceChange({ ...appearanceOverrides, base: value })}
          onReset={() => onAppearanceChange({ ...appearanceOverrides, base: undefined })}
        />
        <ColorControl
          label={t(locale, 'secondaryColor')}
          value={appearanceOverrides.relief ?? reliefColor}
          fallback={reliefColor}
          resetLabel={t(locale, 'resetSecondaryColor')}
          testId="sidebar-color-field"
          onChange={(value) => onAppearanceChange({ ...appearanceOverrides, relief: value })}
          onReset={() => onAppearanceChange({ ...appearanceOverrides, relief: undefined })}
        />
      </div>
    </section>
  );
};

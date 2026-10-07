import { Circle, Ellipse } from 'lucide-react';

import type { KeyringOpeningShape, KeyringPresetId } from '@/domain/keychain/model/keyring-presets';
import type { Locale } from '@/infrastructure/i18n';

import { KEYRING_PRESETS, keyringPresetNameKey } from '@/domain/keychain/model/keyring-presets';
import { t } from '@/infrastructure/i18n';
import { useAnalytics } from '@/infrastructure/telemetry/useTelemetry';

import styles from './KeyringPresetPicker.module.css';

export const KeyringPresetPicker = ({
  locale,
  selected,
  openingShape = 'round',
  widthMm = 5,
  lengthMm = 5,
  variant = 'editor',
  onSelect,
}: {
  locale: Locale;
  selected: KeyringPresetId;
  openingShape?: KeyringOpeningShape;
  widthMm?: number;
  lengthMm?: number;
  variant?: 'editor' | 'setup';
  onSelect: (id: KeyringPresetId) => void;
}) => {
  const { track } = useAnalytics();

  return (
    <fieldset className={`${styles.picker} ${variant === 'setup' ? styles.setup : ''}`}>
      <legend>{t(locale, 'keyringPresets')}</legend>
      <div className={styles.grid}>
        {KEYRING_PRESETS.map((preset) => {
          const Icon = preset.shape === 'slot' ? Ellipse : Circle;
          const iconSize =
            preset.shape === 'slot' ? 25 : Math.round(14 + ((preset.widthMm - 3.5) / 3.5) * 16);
          return (
            <label className={styles.option} key={preset.id}>
              <input
                type="radio"
                name={`keyring-preset-${variant}`}
                data-candidate-key="keyringPreset"
                value={preset.id}
                checked={selected === preset.id}
                onChange={() => {
                  onSelect(preset.id);
                  track('customizer_option_changed', {
                    family: 'keyring_opening',
                    option_id: preset.id,
                  });
                }}
              />
              <span className={styles.iconWell} aria-hidden="true">
                <Icon
                  className={preset.shape === 'slot' ? styles.slot : styles.icon}
                  size={iconSize}
                  strokeWidth={2.2}
                />
              </span>
              <span className={styles.copy}>
                <strong>{t(locale, keyringPresetNameKey(preset.id))}</strong>
                <small>
                  {preset.widthMm === preset.lengthMm
                    ? `${preset.widthMm} mm`
                    : `${preset.widthMm} × ${preset.lengthMm} mm`}
                </small>
              </span>
            </label>
          );
        })}
        {selected === 'custom' && (
          <label className={`${styles.option} ${styles.customOption}`}>
            <input
              type="radio"
              name={`keyring-preset-${variant}`}
              data-candidate-key="keyringPreset"
              value="custom"
              checked
              onChange={() => onSelect('custom')}
            />
            <span className={styles.iconWell} aria-hidden="true">
              {openingShape === 'slot' ? (
                <Ellipse className={styles.slot} size={20} />
              ) : (
                <Circle className={styles.icon} size={20} />
              )}
            </span>
            <span className={styles.copy}>
              <strong>{t(locale, keyringPresetNameKey('custom'))}</strong>
              <small>
                {openingShape === 'slot' ? `${widthMm} × ${lengthMm} mm` : `${widthMm} mm`}
              </small>
            </span>
          </label>
        )}
      </div>
    </fieldset>
  );
};

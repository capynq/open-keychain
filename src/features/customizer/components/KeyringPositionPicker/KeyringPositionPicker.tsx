import type { KeyringPosition } from '@/domain/keychain/model/keyring-position';
import type { Locale } from '@/infrastructure/i18n';

import {
  KEYRING_POSITIONS,
  keyringPositionNameKey,
} from '@/domain/keychain/model/keyring-position';
import { t } from '@/infrastructure/i18n';

import styles from './KeyringPositionPicker.module.css';

// These six points sit on the matching ALEX outline; the radio targets remain 44 px.
const anchors = {
  left: { left: '12.75%', top: '75.23%' },
  right: { left: '89%', top: '75.23%' },
  top: { left: '59.83%', top: '28.38%' },
  bottom: { left: '59.83%', top: '75.68%' },
  'top-left': { left: '18.57%', top: '35.59%' },
  'top-right': { left: '87.36%', top: '27.93%' },
} as const satisfies Record<KeyringPosition, { left: string; top: string }>;

export const KeyringPositionPicker = ({
  locale,
  selected,
  variant = 'editor',
  onSelect,
}: {
  locale: Locale;
  selected: KeyringPosition;
  variant?: 'editor' | 'setup';
  onSelect: (position: KeyringPosition) => void;
}) => (
  <fieldset className={styles.picker}>
    <legend>{t(locale, 'keyringPosition')}</legend>
    <div className={styles.illustration} data-testid="keyring-position-diagram">
      <img
        alt=""
        className={styles.artwork}
        draggable={false}
        src="/showcase/keyring-position-alex.png"
      />

      {KEYRING_POSITIONS.map((position) => (
        <label
          className={styles.option}
          data-position={position}
          key={position}
          style={anchors[position]}
          title={t(locale, keyringPositionNameKey(position))}
        >
          <input
            type="radio"
            name={`keyring-position-${variant}`}
            data-candidate-key="keyringPosition"
            value={position}
            checked={selected === position}
            onChange={() => onSelect(position)}
          />
          <span aria-hidden="true" className={styles.marker}>
            <span className={styles.hole} />
          </span>
          <span className={styles.visuallyHidden}>
            {t(locale, keyringPositionNameKey(position))}
          </span>
        </label>
      ))}
    </div>
    <p
      aria-hidden="true"
      className={styles.selectedPosition}
      data-testid="keyring-position-current"
    >
      {t(locale, keyringPositionNameKey(selected))}
    </p>
  </fieldset>
);

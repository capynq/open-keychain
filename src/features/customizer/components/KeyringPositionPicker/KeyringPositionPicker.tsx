import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpLeft, ArrowUpRight } from 'lucide-react';

import type { KeyringPosition } from '@/domain/keychain/model/keyring-position';
import type { Locale } from '@/infrastructure/i18n';

import {
  KEYRING_POSITIONS,
  keyringPositionNameKey,
} from '@/domain/keychain/model/keyring-position';
import { t } from '@/infrastructure/i18n';

import styles from './KeyringPositionPicker.module.css';

const icons = {
  left: ArrowLeft,
  right: ArrowRight,
  top: ArrowUp,
  bottom: ArrowDown,
  'top-left': ArrowUpLeft,
  'top-right': ArrowUpRight,
} as const;

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
  <fieldset className={`${styles.picker} ${variant === 'setup' ? styles.setup : ''}`}>
    <legend>{t(locale, 'keyringPosition')}</legend>
    <div className={styles.grid}>
      {KEYRING_POSITIONS.map((position) => {
        const Icon = icons[position];
        return (
          <label className={styles.option} key={position}>
            <input
              type="radio"
              name={`keyring-position-${variant}`}
              data-candidate-key="keyringPosition"
              value={position}
              checked={selected === position}
              onChange={() => onSelect(position)}
            />
            <span className={styles.directionWell} aria-hidden="true">
              <Icon size={17} strokeWidth={2.2} />
            </span>
            <span>{t(locale, keyringPositionNameKey(position))}</span>
          </label>
        );
      })}
    </div>
  </fieldset>
);

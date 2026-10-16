import type { Circle } from 'lucide-react';

import {
  ArrowDownUp,
  ArrowLeftRight,
  ArrowUpRight,
  Bold,
  Cloud,
  Heart,
  Layers,
  MoveHorizontal,
  RectangleHorizontal,
  RotateCw,
  Sprout,
  Tag,
  Ticket,
  Type,
} from 'lucide-react';
import { useId } from 'react';

import type { KeychainParams } from '@/domain/keychain/model/types';
import type {
  SimpleOptionGroup,
  SimpleOptionIcon,
} from '@/features/customizer/model/simple-options';
import type { Locale } from '@/infrastructure/i18n';

import { simpleOptionMatches } from '@/features/customizer/model/simple-options';
import { t } from '@/infrastructure/i18n';

import styles from './SimpleOptions.module.css';

const icons = {
  type: ArrowDownUp,
  spacing: ArrowLeftRight,
  bold: Bold,
  outline: RectangleHorizontal,
  layers: Layers,
  relief: Type,
  heart: Heart,
  motion: MoveHorizontal,
  rotate: ArrowUpRight,
  stake: Sprout,
  bubble: Cloud,
  tag: Tag,
  arch: RotateCw,
  ribbon: Ticket,
} satisfies Record<SimpleOptionIcon, typeof Circle>;

export const SimpleChoiceGroup = ({
  locale,
  params,
  group,
  onSelect,
}: {
  locale: Locale;
  params: KeychainParams;
  group: SimpleOptionGroup;
  onSelect: (changes: Partial<KeychainParams>) => void;
}) => {
  const name = useId();
  const selected = group.choices.find((choice) => simpleOptionMatches(params, choice.changes));

  return (
    <fieldset className={styles.picker} data-simple-group={group.id}>
      <legend>
        {t(locale, group.labelKey)}
        {!selected && <span className={styles.custom}>{t(locale, 'simpleCustom')}</span>}
      </legend>
      <div className={styles.choices}>
        {group.choices.map((choice, index) => {
          const Icon = icons[choice.icon];
          return (
            <label className={styles.choice} key={choice.id}>
              <input
                type="radio"
                name={name}
                value={choice.id}
                checked={selected?.id === choice.id}
                data-candidate-key={Object.keys(choice.changes)[0]}
                onChange={() => onSelect(choice.changes)}
              />
              <span className={styles.cue} data-choice-level={index} aria-hidden="true">
                <Icon size={22} strokeWidth={index === 0 ? 1.5 : index === 1 ? 2 : 2.5} />
              </span>
              <span className={styles.choiceCopy}>
                <strong>{t(locale, choice.labelKey)}</strong>
                <small>{t(locale, choice.descriptionKey)}</small>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};

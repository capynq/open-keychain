import { SlidersHorizontal, WandSparkles } from 'lucide-react';
import { useId } from 'react';

import type { EditorMode } from '@/features/customizer/hooks/useEditorMode';
import type { Locale } from '@/infrastructure/i18n';

import { t } from '@/infrastructure/i18n';

import styles from './SimpleOptions.module.css';

export const EditorModeSwitch = ({
  locale,
  mode,
  onChange,
}: {
  locale: Locale;
  mode: EditorMode;
  onChange: (mode: EditorMode) => void;
}) => {
  const name = useId();

  return (
    <fieldset className={styles.mode} data-testid="editor-mode">
      <legend className="sr-only">{t(locale, 'editorMode')}</legend>
      {(['simple', 'pro'] as const).map((value) => {
        const Icon = value === 'simple' ? WandSparkles : SlidersHorizontal;
        return (
          <label className={styles.modeOption} key={value}>
            <input
              type="radio"
              name={name}
              value={value}
              checked={mode === value}
              onChange={() => onChange(value)}
            />
            <Icon size={17} aria-hidden="true" />
            <span>{t(locale, value === 'simple' ? 'editorModeSimple' : 'editorModePro')}</span>
          </label>
        );
      })}
    </fieldset>
  );
};

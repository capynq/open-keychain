import type { Dispatch, SetStateAction } from 'react';

import { Check } from 'lucide-react';

import type { Locale } from '@/infrastructure/i18n';

import { FONT_CATEGORY_ORDER, type FontCategory } from '@/domain/keychain/fonts/catalog';
import { FontSpecimen } from '@/features/customizer/components/FontSpecimen/FontSpecimen';
import { t } from '@/infrastructure/i18n';
import { useAnalytics } from '@/infrastructure/telemetry/useTelemetry';

import type { QuickSetupDraft } from './model/useQuickSetupDraft';

import styles from './QuickSetupDialog.module.css';

const categoryKey = (category: FontCategory): string =>
  `fontCategory${category.replace(/[^A-Za-z]/g, '')}`;

const categorySpecimenFont: Record<FontCategory, string> = {
  Rounded: 'nunito',
  Geometric: 'quicksand',
  Chunky: 'fredoka',
  Condensed: 'oswald',
  Serif: 'bree-serif',
  Playful: 'baloo2',
  Decorative: 'bungee',
  Handwritten: 'kalam',
  Calligraphic: 'marck-script',
  Marker: 'amatic-sc',
};

export const FontStep = ({
  locale,
  draft,
  setDraft,
}: {
  locale: Locale;
  draft: QuickSetupDraft;
  setDraft: Dispatch<SetStateAction<QuickSetupDraft>>;
}) => {
  const { track } = useAnalytics();
  const categories = FONT_CATEGORY_ORDER;

  return (
    <div className={styles.stepContent}>
      <p className={styles.help}>{t(locale, 'wizardFontsHelp')}</p>
      <fieldset className={styles.favorites}>
        <legend className="sr-only">{t(locale, 'quickSetupFavoriteFonts')}</legend>
        <div className={styles.favoriteGrid}>
          {categories.map((category) => (
            <label className={styles.choiceCard} key={category}>
              <input
                type="checkbox"
                checked={draft.favoriteCategories.includes(category)}
                onChange={() => {
                  setDraft((current) => ({
                    ...current,
                    favoriteCategories: current.favoriteCategories.includes(category)
                      ? current.favoriteCategories.filter((item) => item !== category)
                      : [...current.favoriteCategories, category],
                  }));
                  track('customizer_option_changed', {
                    family: 'font_category',
                    option_id: category,
                  });
                }}
              />
              <Check className={styles.choiceCheck} aria-hidden="true" />
              {/* `.choiceCard span` gave the text specimen a 1.4 line box; keep that height. */}
              <FontSpecimen
                className={styles.categorySpecimen}
                fontId={categorySpecimenFont[category]}
                script="latin"
                lineHeight={1.4}
              />
              <span className={styles.categoryLabel}>{t(locale, categoryKey(category))}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
};

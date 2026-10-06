import type { Dispatch, SetStateAction } from 'react';

import { Check } from 'lucide-react';

import type { Locale } from '@/infrastructure/i18n';

import { FONT_CATEGORY_ORDER, type FontCategory } from '@/domain/keychain/fonts/catalog';
import { FONT_CATALOG } from '@/domain/keychain/fonts/catalog';
import { t } from '@/infrastructure/i18n';

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

const categorySpecimen = (category: FontCategory) =>
  FONT_CATALOG.find((font) => font.id === categorySpecimenFont[category]);

const specimenLabel = String.fromCharCode(65, 97);

export const FontStep = ({
  locale,
  draft,
  setDraft,
}: {
  locale: Locale;
  draft: QuickSetupDraft;
  setDraft: Dispatch<SetStateAction<QuickSetupDraft>>;
}) => {
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
                onChange={() =>
                  setDraft((current) => ({
                    ...current,
                    favoriteCategories: current.favoriteCategories.includes(category)
                      ? current.favoriteCategories.filter((item) => item !== category)
                      : [...current.favoriteCategories, category],
                  }))
                }
              />
              <Check className={styles.choiceCheck} aria-hidden="true" />
              <span
                className={styles.categorySpecimen}
                aria-hidden="true"
                style={
                  categorySpecimen(category)
                    ? {
                        fontFamily: categorySpecimen(category)?.previewFamily,
                        fontWeight: categorySpecimen(category)?.weight,
                      }
                    : undefined
                }
              >
                {specimenLabel}
              </span>
              <span className={styles.categoryLabel}>{t(locale, categoryKey(category))}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
};

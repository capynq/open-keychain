import type { ReactNode } from 'react';

import { useMemo } from 'react';

import type { GeometryResult, KeychainParams } from '@/domain/keychain/model/types';
import type { CandidateControlGroup } from '@/features/customizer/hooks/useCustomizerParams';
import type { SimpleOptionGroup } from '@/features/customizer/model/simple-options';
import type { Locale } from '@/infrastructure/i18n';

import { simpleOptionGroups } from '@/features/customizer/model/simple-options';
import { t } from '@/infrastructure/i18n';

import { GeometryFinishControls } from './GeometryFinishControls';
import { SimpleChoiceGroup } from './SimpleChoiceGroup';
import styles from './SimpleOptions.module.css';

type Presentation = SimpleOptionGroup['presentation'];

const sections: { id: Presentation; labelKey: string; feedbackGroup: CandidateControlGroup }[] = [
  { id: 'typography', labelKey: 'typography', feedbackGroup: 'refine' },
  {
    id: 'template-details',
    labelKey: 'parameterGroupTemplateDetails',
    feedbackGroup: 'template-details',
  },
  { id: 'style-details', labelKey: 'styleDetails', feedbackGroup: 'style-details' },
  { id: 'shape', labelKey: 'shape', feedbackGroup: 'refine' },
  { id: 'print', labelKey: 'print', feedbackGroup: 'print' },
];

export const SimpleAdjustments = ({
  locale,
  params,
  baseFinishLimits,
  textFinishLimits,
  updateMany,
  renderFeedback,
  baseFinishFeedback,
  textFinishFeedback,
  onPro,
  onReset,
}: {
  locale: Locale;
  params: KeychainParams;
  baseFinishLimits?: GeometryResult['baseFinishLimits'];
  textFinishLimits?: GeometryResult['textFinishLimits'];
  updateMany: (changes: Partial<KeychainParams>, group?: CandidateControlGroup) => void;
  baseFinishFeedback?: ReactNode;
  textFinishFeedback?: ReactNode;
  renderFeedback: (group: CandidateControlGroup, presentation: Presentation) => ReactNode;
  onPro: (destination: Presentation) => void;
  onReset: () => void;
}) => {
  const groups = useMemo(() => simpleOptionGroups(params), [params]);

  return (
    <section
      className="control-section adjustment-settings"
      data-control-group="adjustments"
      data-testid="simple-adjustment-settings"
    >
      <h2>{t(locale, 'adjustments')}</h2>
      {sections.map((section) => {
        const choices = groups.filter((group) => group.presentation === section.id);
        const feedback = renderFeedback(section.feedbackGroup, section.id);
        if (!choices.length && section.id !== 'print' && !feedback) return null;
        return (
          <div
            className={`control-subsection ${styles.stack}`}
            data-adjustment-subcategory={section.id}
            data-control-group={section.feedbackGroup}
            key={section.id}
          >
            <h3>{t(locale, section.labelKey)}</h3>
            {choices.map((group) => (
              <SimpleChoiceGroup
                key={group.id}
                locale={locale}
                params={params}
                group={group}
                onSelect={(changes) => updateMany(changes, group.candidateGroup)}
              />
            ))}
            {section.id === 'print' && (
              <GeometryFinishControls
                locale={locale}
                params={params}
                baseFinishLimits={baseFinishLimits}
                limits={textFinishLimits}
                updateMany={updateMany}
                simple
                baseFeedback={baseFinishFeedback}
                textFeedback={textFinishFeedback}
              />
            )}
            {feedback}
            <button
              type="button"
              className={styles.more}
              onClick={() => onPro(section.id)}
              aria-label={`${t(locale, 'simpleFineTune')}: ${t(locale, section.labelKey)}`}
            >
              {t(locale, 'simpleFineTune')}
            </button>
          </div>
        );
      })}
      <button type="button" className="reset-settings" onClick={onReset}>
        {t(locale, 'resetSettings')}
      </button>
      <div className="controls-scroll-spacer" aria-hidden="true" />
    </section>
  );
};

import type { KeychainParams } from '@/domain/keychain/model/types';
import type { Locale } from '@/infrastructure/i18n';

import { finishStrengths } from '@/features/customizer/model/finish-strengths';

import { SimpleChoiceGroup } from './SimpleChoiceGroup';

export const FinishStrengthChoices = ({
  locale,
  params,
  target,
  maximumMm,
  onSelect,
}: {
  locale: Locale;
  params: KeychainParams;
  target: 'base' | 'text';
  maximumMm: number;
  onSelect: (changes: Partial<KeychainParams>) => void;
}) => {
  const strengths = finishStrengths(maximumMm);
  if (!strengths.length) return null;
  return (
    <SimpleChoiceGroup
      locale={locale}
      params={params}
      group={{
        id: `${target}-finish-strength`,
        labelKey: target === 'base' ? 'simpleBackingStrength' : 'simpleTextStrength',
        candidateGroup: 'print',
        presentation: 'print',
        choices: strengths.map((strength) => ({
          id: strength.id,
          labelKey: `simpleEffect${strength.id}`,
          descriptionKey: `simpleEffect${strength.id}Description`,
          icon: 'outline',
          changes:
            target === 'base'
              ? { topEdgeMm: strength.amountMm, bottomEdgeMm: strength.amountMm }
              : { textEdgeMm: strength.amountMm },
        })),
      }}
      onSelect={onSelect}
    />
  );
};

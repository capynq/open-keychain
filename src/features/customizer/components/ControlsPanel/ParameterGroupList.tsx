import type { ReactNode } from 'react';

import type { KeychainParams } from '@/domain/keychain/model/types';

import {
  PARAMETER_GROUPS,
  parameterPresentationGroup,
  type ParameterPresentationGroup,
  type CustomizerParameter,
  type ShapeParameter,
} from '@/domain/keychain/model/parameters';
import { t, type Locale } from '@/infrastructure/i18n';

export type ParameterGroupListProps = {
  locale: Locale;
  params: KeychainParams;
  presentation: ParameterPresentationGroup;
  showsParameter: (parameter: CustomizerParameter) => boolean;
  update: <K extends keyof KeychainParams>(key: K, value: KeychainParams[K]) => void;
  renderParameter: (parameter: ShapeParameter) => ReactNode;
};

export const ParameterGroupList = ({
  locale,
  params,
  presentation,
  showsParameter,
  update,
  renderParameter,
}: ParameterGroupListProps) => (
  <div
    className="control-subsection shape-figure-settings"
    data-testid={`${presentation}-settings`}
  >
    {PARAMETER_GROUPS.map((group) => {
      const controls = group.parameters
        .filter((parameter) => parameterPresentationGroup(params, parameter) === presentation)
        .map(renderParameter)
        .filter(Boolean);
      if (!controls.length) return null;
      const presentationKey = group.key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      const isHeadingAlreadyShown =
        presentationKey === presentation ||
        (group.key === 'heart' && params.styleId === 'heart-split');
      return (
        <div className="parameter-group" data-parameter-group={group.key} key={group.key}>
          {!isHeadingAlreadyShown && (
            <h4>{t(locale, `parameterGroup${group.key[0].toUpperCase()}${group.key.slice(1)}`)}</h4>
          )}
          <div className="range-grid">{controls}</div>
        </div>
      );
    })}
    {presentation === 'template-details' && showsParameter('plantAccentEnabled') && (
      <label className="check-control">
        <input
          type="checkbox"
          checked={params.plantAccentEnabled}
          onChange={(event) => update('plantAccentEnabled', event.target.checked)}
        />
        <span>{t(locale, 'plantAccents')}</span>
      </label>
    )}
  </div>
);

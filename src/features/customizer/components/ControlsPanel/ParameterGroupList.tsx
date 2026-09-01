import type { ReactNode } from 'react';

import type { CustomizerParameter, KeychainParams, ShapeParameter } from '@/domain/keychain';

import { PARAMETER_GROUPS } from '@/domain/keychain';
import { t, type Locale } from '@/infrastructure/i18n';

export type ParameterGroupListProps = {
  locale: Locale;
  params: KeychainParams;
  showsParameter: (parameter: CustomizerParameter) => boolean;
  update: <K extends keyof KeychainParams>(key: K, value: KeychainParams[K]) => void;
  renderParameter: (parameter: ShapeParameter) => ReactNode;
};

export const ParameterGroupList = ({
  locale,
  params,
  showsParameter,
  update,
  renderParameter,
}: ParameterGroupListProps) => (
  <div className="control-subsection shape-figure-settings" data-testid="figure-settings">
    <h3>{t(locale, 'figureSettings')}</h3>
    {PARAMETER_GROUPS.map((group) => {
      const controls = group.parameters.map(renderParameter).filter(Boolean);
      if (!controls.length) return null;
      return (
        <div className="parameter-group" data-parameter-group={group.key} key={group.key}>
          <h3>{t(locale, `parameterGroup${group.key[0].toUpperCase()}${group.key.slice(1)}`)}</h3>
          <div className="range-grid">{controls}</div>
        </div>
      );
    })}
    {showsParameter('plantAccentEnabled') && (
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

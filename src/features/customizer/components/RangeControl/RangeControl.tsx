import { useId, useState } from 'react';

import { t, type Locale } from '@/infrastructure/i18n';

import { commitRangeValue, decimalsFor } from './range-value';
import './RangeControl.css';

export const RangeControl = ({
  label,
  value,
  min,
  max,
  step,
  unit,
  candidateKey,
  locale = 'en',
  onChange,
}: {
  label: string;
  locale?: Locale;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  candidateKey?: string;
  onChange: (value: number) => void;
}) => {
  const id = useId();
  const labelId = `${id}-label`;
  const [draft, setDraft] = useState<string>();
  const shown = value.toFixed(Math.max(1, decimalsFor(step)));
  const commit = (): void => {
    if (draft === undefined) return;
    const next = commitRangeValue(draft, min, max, step);
    setDraft(undefined);
    if (next !== undefined && next !== value) onChange(next);
  };

  return (
    <div className="range-control">
      <span className="control-label">
        <label id={labelId} htmlFor={`${id}-range`}>
          {label}
        </label>
        <span className="range-value">
          <input
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={draft ?? shown}
            aria-label={t(locale, 'exactValue')}
            aria-describedby={labelId}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit();
              if (event.key === 'Escape') setDraft(undefined);
            }}
          />
          <span aria-hidden="true">{unit}</span>
        </span>
      </span>
      <input
        id={`${id}-range`}
        type="range"
        data-candidate-key={candidateKey}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
      />
    </div>
  );
};

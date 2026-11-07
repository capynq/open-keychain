import { useId, useState } from 'react';
import { useNavigate } from 'react-router';

import type { Locale } from '@/infrastructure/i18n';

import { t } from '@/infrastructure/i18n';
import { useAnalytics } from '@/infrastructure/telemetry/useTelemetry';

import { createSetupPath, SETUP_TEXT_LIMIT } from '../../../../shared/lib/create-path';

/**
 * The landing page's first step: type the name here and quick setup opens with it filled in.
 * The name travels in router state, never in the URL, analytics or logs.
 */
export const HeroNameForm = ({
  locale,
  source,
  className,
}: {
  locale: Locale;
  source: 'hero' | 'final_cta';
  className?: string;
}) => {
  const inputId = useId();
  const hintId = useId();
  const navigate = useNavigate();
  const { track } = useAnalytics();
  const [name, setName] = useState('');

  return (
    <form
      className={['landing-name-form', className].filter(Boolean).join(' ')}
      data-preload-route="create"
      onSubmit={(event) => {
        event.preventDefault();
        const setupText = name.trim();

        track('start_designing', { source, prefilled: Boolean(setupText) });
        void navigate(createSetupPath(locale), setupText ? { state: { setupText } } : undefined);
      }}
    >
      <div className="landing-name-row">
        <label className="landing-name-field" htmlFor={inputId}>
          <span>{t(locale, 'landing.heroNameLabel')}</span>
          <input
            id={inputId}
            type="text"
            value={name}
            maxLength={SETUP_TEXT_LIMIT}
            placeholder={t(locale, 'landing.heroNamePlaceholder')}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-describedby={hintId}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button className="landing-button landing-button-primary" type="submit">
          {t(locale, 'landing.startDesigning')}
          <span aria-hidden="true">→</span>
        </button>
      </div>
      <p className="landing-name-hint" id={hintId}>
        {t(locale, 'landing.heroNameHint')}
      </p>
    </form>
  );
};

import { useMemo, useState } from 'react';

import { estimateLaborSavings } from '@/features/hosted/model/labor-savings';

import type { Locale } from '../../../infrastructure/i18n/config';

import { t } from '../../../infrastructure/i18n/utils';

const localeTag: Record<Locale, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  uk: 'uk-UA',
};

export const BatchLaborEstimate = ({
  locale,
  orderCount,
}: {
  locale: Locale;
  orderCount: number;
}) => {
  const [manualMinutesPerOrder, setManualMinutesPerOrder] = useState(0);
  const [activeHandlingMinutes, setActiveHandlingMinutes] = useState(0);
  const [hourlyValue, setHourlyValue] = useState(0);
  const estimate = useMemo(
    () =>
      estimateLaborSavings({
        orderCount,
        manualMinutesPerOrder,
        activeHandlingMinutes,
        hourlyValue,
      }),
    [activeHandlingMinutes, hourlyValue, manualMinutesPerOrder, orderCount],
  );
  const opportunityValue = new Intl.NumberFormat(localeTag[locale], {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(estimate.estimatedOpportunityValue);

  return (
    <section className="profile-batch-estimate" aria-labelledby="batch-labor-title">
      <h3 id="batch-labor-title">{t(locale, 'batchLaborTitle')}</h3>
      <label>
        {t(locale, 'batchManualMinutes')}
        <input
          type="number"
          min="0"
          step="1"
          value={manualMinutesPerOrder}
          onChange={(event) => setManualMinutesPerOrder(Number(event.target.value))}
        />
      </label>
      <label>
        {t(locale, 'batchHandlingMinutes')}
        <input
          type="number"
          min="0"
          step="1"
          value={activeHandlingMinutes}
          onChange={(event) => setActiveHandlingMinutes(Number(event.target.value))}
        />
      </label>
      <label>
        {t(locale, 'batchHourlyValue')}
        <input
          type="number"
          min="0"
          step="0.01"
          value={hourlyValue}
          onChange={(event) => setHourlyValue(Number(event.target.value))}
        />
      </label>
      <output aria-live="polite" aria-atomic="true">
        {t(locale, 'batchOpportunity', {
          value: opportunityValue,
        })}
      </output>
      <small>{t(locale, 'batchOpportunityHelp')}</small>
    </section>
  );
};

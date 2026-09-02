import type { Locale } from '../../../infrastructure/i18n/config';

import { t } from '../../../infrastructure/i18n/utils';

export const RouteLoading = ({ locale }: { locale: Locale }) => (
  <div className="route-loading" role="status" aria-live="polite">
    {t(locale, 'fontLoading')}
  </div>
);

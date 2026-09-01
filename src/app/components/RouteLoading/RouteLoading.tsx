import { t, type Locale } from '../../../infrastructure/i18n';

export const RouteLoading = ({ locale }: { locale: Locale }) => (
  <div className="route-loading" role="status" aria-live="polite">
    {t(locale, 'fontLoading')}
  </div>
);

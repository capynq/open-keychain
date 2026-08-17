import type { HostedAccountState } from '../../features/hosted';
import type { Locale } from '../../infrastructure/i18n';
import { CustomizerNavigationHeader } from './CustomizerNavigationHeader';
import { LandingNavigationHeader } from './LandingNavigationHeader';

export const AppHeader = ({
  variant,
  locale,
  onLocaleChange,
  exportOpen = false,
  onExportOpen,
  hosted,
}: {
  variant: 'landing' | 'customizer';
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  exportOpen?: boolean;
  onExportOpen?: () => void;
  hosted?: HostedAccountState;
}) =>
  variant === 'landing' ? (
    <LandingNavigationHeader locale={locale} onLocaleChange={onLocaleChange} />
  ) : (
    <CustomizerNavigationHeader
      locale={locale}
      onLocaleChange={onLocaleChange}
      exportOpen={exportOpen}
      onExportOpen={onExportOpen}
      hosted={hosted}
    />
  );

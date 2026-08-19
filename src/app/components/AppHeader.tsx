import { lazy, Suspense } from 'react';
import type { HostedAccountState } from '../../features/hosted';
import type { KeychainParams } from '../../domain/keychain';
import type { Locale } from '../../infrastructure/i18n';
import { LandingNavigationHeader } from './LandingNavigationHeader';

const CustomizerNavigationHeader = lazy(() =>
  import('./CustomizerNavigationHeader').then(({ CustomizerNavigationHeader: header }) => ({
    default: header,
  })),
);

export const AppHeader = ({
  variant,
  locale,
  onLocaleChange,
  exportOpen = false,
  onExportOpen,
  hosted,
  currentParams,
}: {
  variant: 'landing' | 'customizer';
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  exportOpen?: boolean;
  onExportOpen?: () => void;
  hosted?: HostedAccountState;
  currentParams?: KeychainParams;
}) =>
  variant === 'landing' ? (
    <LandingNavigationHeader locale={locale} onLocaleChange={onLocaleChange} />
  ) : (
    <Suspense fallback={null}>
      <CustomizerNavigationHeader
        locale={locale}
        onLocaleChange={onLocaleChange}
        exportOpen={exportOpen}
        onExportOpen={onExportOpen}
        hosted={hosted}
        currentParams={currentParams}
      />
    </Suspense>
  );

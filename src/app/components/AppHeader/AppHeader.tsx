import { lazy, Suspense } from 'react';
import type { HostedAccountState } from '../../../features/hosted';
import type { KeychainParams } from '../../../domain/keychain';
import type { Locale } from '../../../infrastructure/i18n';
import { LandingNavigationHeader } from '../LandingNavigationHeader/LandingNavigationHeader';
import './AppHeader.module.css';

const CustomizerNavigationHeader = lazy(() =>
  import('../CustomizerNavigationHeader/CustomizerNavigationHeader').then(
    ({ CustomizerNavigationHeader: header }) => ({
      default: header,
    }),
  ),
);

export const AppHeader = ({
  variant,
  locale,
  onLocaleChange,
  exportOpen = false,
  onExportOpen,
  onShare,
  onRandomize,
  onUndo,
  canUndo,
  randomizing,
  exportDisabled,
  hosted,
  currentParams,
}: {
  variant: 'landing' | 'customizer';
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  exportOpen?: boolean;
  onExportOpen?: () => void;
  onShare?: () => void;
  onRandomize?: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
  randomizing?: boolean;
  exportDisabled?: boolean;
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
        onShare={onShare}
        onRandomize={onRandomize}
        onUndo={onUndo}
        canUndo={canUndo}
        randomizing={randomizing}
        exportDisabled={exportDisabled}
        hosted={hosted}
        currentParams={currentParams}
      />
    </Suspense>
  );

import { useLocation } from 'react-router';

import { AppHeader } from '../../app/components/AppHeader/AppHeader';
import { CustomizerFooter } from '../../app/components/CustomizerFooter/CustomizerFooter';
import { CustomizerWorkspace } from '../../app/components/CustomizerWorkspace/CustomizerWorkspace';
import { Toast, type ToastVariant } from '../../app/components/Toast/Toast';
import { useCustomizerPageState } from '../../app/hooks/useCustomizerPageState';
import { applyPrintAppearanceOverrides } from '../../entities/keychain';
import { ExportDialog, buildPreflightReport } from '../../features/export';
import { t, type Locale } from '../../infrastructure/i18n';
import { parseCustomizerRoute } from './model/parseCustomizerRoute';
import './CustomizerPage.module.css';
import '../../app/styles/customizer.css';
import '../../app/styles/preview.css';

export const CustomizerPage = ({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}) => {
  const location = useLocation();
  const routeModel = parseCustomizerRoute(location.search, location.state);
  const state = useCustomizerPageState(
    locale,
    routeModel.initialParams,
    routeModel.initialAppearanceOverrides,
    routeModel.routeInputKey,
  );

  return (
    <main className="app-shell" aria-label="Customizer">
      <AppHeader
        variant="customizer"
        locale={locale}
        onLocaleChange={onLocaleChange}
        exportOpen={state.exportOpen}
        onExportOpen={state.openExport}
        onShare={() => void state.shareDesign()}
        onRandomize={state.randomize}
        onUndo={state.undo}
        canUndo={state.customizer.canUndo}
        randomizing={state.randomizing}
        exportDisabled={!state.canExport}
        hosted={state.hosted}
        currentParams={state.customizer.params}
      />
      {(routeModel.hasInvalidDesign ||
        routeModel.sharedFontFallback ||
        state.shareFontFallback ||
        state.shareStatus !== 'idle' ||
        state.randomizeFailure) &&
        (() => {
          const variant: ToastVariant = routeModel.hasInvalidDesign
            ? 'error'
            : state.randomizeFailure
              ? 'error'
              : state.shareStatus === 'failed'
                ? 'error'
                : state.shareStatus === 'manual'
                  ? 'manual'
                  : 'success';
          const message = routeModel.hasInvalidDesign
            ? t(locale, 'shareInvalid')
            : state.randomizeFailure
              ? t(locale, 'randomizeFailed')
              : state.shareStatus === 'failed'
                ? t(locale, 'shareFailed')
                : state.shareStatus === 'manual'
                  ? t(locale, 'shareManual')
                  : routeModel.sharedFontFallback || state.shareFontFallback
                    ? t(locale, 'shareFontFallback')
                    : t(locale, 'shareCopied');

          return (
            <Toast variant={variant}>
              {state.shareStatus === 'manual' && state.shareUrl ? (
                <div className="share-manual-content">
                  <span>{message}</span>
                  <input
                    aria-label={t(locale, 'shareManualPrompt')}
                    className="share-manual-input"
                    onFocus={(event) => event.currentTarget.select()}
                    readOnly
                    value={state.shareUrl}
                  />
                  <button
                    className="share-manual-copy"
                    onClick={() => void state.shareDesign()}
                    type="button"
                  >
                    {t(locale, 'copyLink')}
                  </button>
                </div>
              ) : (
                message
              )}
            </Toast>
          );
        })()}
      <CustomizerWorkspace locale={locale} state={state} />
      <CustomizerFooter locale={locale} />
      <ExportDialog
        locale={locale}
        open={state.exportOpen}
        exportState={state.exportState}
        preflight={buildPreflightReport(
          state.geometry.result,
          state.geometry.result
            ? applyPrintAppearanceOverrides(
                state.geometry.result.appearance,
                state.appearanceOverrides,
              )
            : undefined,
          state.geometry.busy || state.geometry.current === false,
          state.geometry.error,
        )}
        effectiveAppearance={
          state.geometry.result &&
          !state.geometry.busy &&
          state.geometry.current !== false &&
          !state.geometry.error
            ? applyPrintAppearanceOverrides(
                state.geometry.result.appearance,
                state.appearanceOverrides,
              )
            : undefined
        }
        onClose={() => state.setExportOpen(false)}
      />
    </main>
  );
};

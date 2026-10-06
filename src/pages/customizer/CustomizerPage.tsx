import { useLocation, useNavigate } from 'react-router';

import { CustomizerFooter } from '@/app/components/CustomizerFooter/CustomizerFooter';
import { CustomizerNavigationHeader } from '@/app/components/CustomizerNavigationHeader/CustomizerNavigationHeader';
import { CustomizerWorkspace } from '@/app/components/CustomizerWorkspace/CustomizerWorkspace';
import { QuickSetupDialog } from '@/app/components/QuickSetupDialog/QuickSetupDialog';
import { Toast, type ToastVariant } from '@/app/components/Toast/Toast';
import { useCustomizerPageState } from '@/app/hooks/useCustomizerPageState';
import { selectAcceptedMetrics } from '@/domain/keychain/model/accepted-metrics';
import { TEMPLATE_CATALOG } from '@/domain/keychain/templates/template-builder';
import { applyPrintAppearanceOverrides } from '@/entities/keychain/model/types';
import { useQuickSetup } from '@/features/customizer/hooks/useQuickSetup';
import { setupAppearance } from '@/features/customizer/model/quick-setup';
import { useWebMcp } from '@/features/webmcp/hooks/useWebMcp';

import type { Locale } from '../../infrastructure/i18n/config';

import { ExportDialog } from '../../features/export/components/ExportDialog/ExportDialog';
import { buildPreflightReport } from '../../features/export/model/preflight';
import { t } from '../../infrastructure/i18n/utils';
import { parseCustomizerRoute } from './model/parseCustomizerRoute';
import './CustomizerPage.module.css';
import '../../app/styles/customizer.css';
import '../../app/styles/preview.css';

/* eslint-disable max-lines-per-function */
export const CustomizerPage = ({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const routeModel = parseCustomizerRoute(location.search, location.state);
  const state = useCustomizerPageState(
    locale,
    routeModel.initialParams,
    routeModel.initialAppearanceOverrides,
    routeModel.routeInputKey,
  );
  const quickSetup = useQuickSetup({
    search: location.search,
    locationState: location.state,
    locale,
    navigate,
    customizer: state.customizer,
    onAppearanceChange: state.setAppearanceOverrides,
  });
  const acceptedMetrics = selectAcceptedMetrics(
    state.geometry.result,
    state.customizer.acceptedParams.sizeEnvelope,
  );
  useWebMcp(state.customizer, {
    ...state.modelInfo,
    printable: Boolean(state.geometry.result?.printable),
    busy: state.geometry.busy,
    error: state.geometry.error,
    dimensions: state.geometry.result?.dimensions,
  });

  return (
    <main className="app-shell" aria-label="Customizer">
      <CustomizerNavigationHeader
        locale={locale}
        onLocaleChange={onLocaleChange}
        exportOpen={state.exportOpen}
        onExportOpen={state.openExport}
        onShare={() => void state.shareDesign()}
        onSetupOpen={quickSetup.openSetup}
        setupOpen={quickSetup.setupOpen}
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
      <CustomizerWorkspace
        locale={locale}
        state={state}
        favoriteFontCategories={quickSetup.favoriteFontCategories}
      />
      <QuickSetupDialog
        locale={locale}
        open={quickSetup.setupOpen}
        submitting={quickSetup.setupSubmitting}
        checking={state.customizer.candidateFeedback?.status === 'checking'}
        error={quickSetup.setupError ? t(locale, 'quickSetupRejected') : undefined}
        onClose={quickSetup.closeSetup}
        onApply={quickSetup.applySetup}
        initialText={state.customizer.params.text}
        supportsKeyring={
          TEMPLATE_CATALOG.find(
            (template) => template.id === state.customizer.acceptedParams.templateId,
          )?.supportsKeyring ?? false
        }
        initialKeyringPreset={state.customizer.acceptedParams.keyringPreset ?? 'standard-round'}
        initialKeyringPosition={state.customizer.acceptedParams.keyringPosition ?? 'left'}
        initialKeyringOpeningShape={state.customizer.acceptedParams.keyringOpeningShape ?? 'round'}
        initialKeyringWidthMm={state.customizer.acceptedParams.holeDiameterMm}
        initialKeyringLengthMm={
          state.customizer.acceptedParams.keyringSlotLengthMm ??
          state.customizer.acceptedParams.holeDiameterMm
        }
        initialAppearanceOverrides={setupAppearance(
          state.customizer.acceptedParams.templateId,
          state.appearanceOverrides,
          state.geometry.result?.appearance,
        )}
        initialSize={state.customizer.acceptedParams.sizeEnvelope}
        initialFavoriteCategories={quickSetup.favoriteFontCategories}
        acceptedMetrics={acceptedMetrics}
        acceptedText={state.customizer.acceptedParams.text}
      />
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
          state.disconnectedExportAcknowledged,
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
        acceptedMetrics={acceptedMetrics}
        onClose={() => state.setExportOpen(false)}
        disconnectedExportAcknowledged={state.disconnectedExportAcknowledged}
        onDisconnectedExportAcknowledged={state.setDisconnectedExportAcknowledged}
      />
    </main>
  );
};

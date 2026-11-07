import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { CustomizerNavigationHeader } from '@/app/components/CustomizerNavigationHeader/CustomizerNavigationHeader';
import { CustomizerNotices } from '@/app/components/CustomizerNotices/CustomizerNotices';
import { CustomizerWorkspace } from '@/app/components/CustomizerWorkspace/CustomizerWorkspace';
import { suggestedSizeEnvelope } from '@/app/components/QuickSetupDialog/model/useQuickSetupDraft';
import { QuickSetupDialog } from '@/app/components/QuickSetupDialog/QuickSetupDialog';
import { useCustomizerPageState } from '@/app/hooks/useCustomizerPageState';
import { useStickyPreview } from '@/app/hooks/useStickyPreview';
import { useUndoShortcuts } from '@/app/hooks/useUndoShortcuts';
import { selectAcceptedMetrics } from '@/domain/keychain/model/accepted-metrics';
import { TEMPLATE_CATALOG } from '@/domain/keychain/templates/template-builder';
import { applyPrintAppearanceOverrides } from '@/entities/keychain/model/types';
import { useQuickSetup } from '@/features/customizer/hooks/useQuickSetup';
import { setupAppearance } from '@/features/customizer/model/quick-setup';
import { ExportFeedback } from '@/features/feedback/components/ExportFeedback/ExportFeedback';
import { PrintCheckNotice } from '@/features/feedback/components/PrintCheckNotice/PrintCheckNotice';
import { useExportFeedback } from '@/features/feedback/hooks/useExportFeedback';
import { usePrintCheck } from '@/features/feedback/hooks/usePrintCheck';
import { SharePopover } from '@/features/share/components/SharePopover';
import { buildShareUrl } from '@/features/share/model/share-url';
import { useWebMcp } from '@/features/webmcp/hooks/useWebMcp';
import { recoveryMessage } from '@/infrastructure/i18n/utils';
import { setSupportDesignUrlProvider } from '@/shared/lib/support/support-report';

import type { Locale } from '../../infrastructure/i18n/config';

import { ExportDialog } from '../../features/export/components/ExportDialog/ExportDialog';
import { buildPreflightReport } from '../../features/export/model/preflight';
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
    onAppearanceChange: state.editAppearance,
  });
  const acceptedMetrics = selectAcceptedMetrics(
    state.geometry.result,
    state.customizer.acceptedParams.sizeEnvelope,
  );
  const exportFeedback = useExportFeedback(locale);
  const printCheck = usePrintCheck(locale, !state.exportOpen && !quickSetup.setupOpen);
  const exportedDesignUrl = (): string | undefined => {
    try {
      return buildShareUrl(
        window.location.href,
        state.customizer.acceptedParams,
        state.appearanceOverrides,
      );
    } catch {
      return undefined;
    }
  };

  const closeExport = (): void => {
    exportFeedback.close();
    state.setExportOpen(false);
  };

  const supportDesignParams = state.customizer.acceptedParams;
  const supportAppearance = state.appearanceOverrides;
  useEffect(() => {
    setSupportDesignUrlProvider(() =>
      buildShareUrl(window.location.href, supportDesignParams, supportAppearance),
    );

    return () => setSupportDesignUrlProvider(undefined);
  }, [supportDesignParams, supportAppearance]);
  useUndoShortcuts(state.undo, state.redo);
  useStickyPreview();
  useWebMcp(state.customizer, {
    ...state.modelInfo,
    printable: Boolean(state.geometry.result?.printable),
    busy: state.geometry.busy,
    error: state.geometry.error,
    dimensions: state.geometry.result?.dimensions,
  });

  return (
    <main className="app-shell customizer-app-shell" aria-label="Customizer">
      <CustomizerNavigationHeader
        locale={locale}
        onLocaleChange={onLocaleChange}
        exportOpen={state.exportOpen}
        onExportOpen={state.openExport}
        shareAction={
          <SharePopover
            locale={locale}
            share={state.share}
            fontFallback={routeModel.sharedFontFallback}
            disabled={state.randomizing}
          />
        }
        onSetupOpen={quickSetup.openSetup}
        setupOpen={quickSetup.setupOpen}
        onRandomize={state.randomize}
        onUndo={state.undo}
        canUndo={state.customizer.canUndo}
        undoKind={state.customizer.undoKind}
        onRedo={state.redo}
        canRedo={state.customizer.canRedo}
        randomizing={state.randomizing}
        exportDisabled={!state.canExport && !state.exportWaiting}
        exportQueued={state.exportQueued}
        hosted={state.hosted}
        currentParams={state.customizer.params}
      />
      <CustomizerNotices
        locale={locale}
        invalidDesign={routeModel.hasInvalidDesign}
        fontFallback={routeModel.sharedFontFallback}
        randomizeFailure={state.randomizeFailure}
        recoveryApplied={state.customizer.canUndo && state.customizer.undoKind === 'recovery'}
        onNewDesign={() => {
          void navigate('/create', { replace: true });
        }}
        onRetryRandomize={() => {
          state.randomize();
        }}
      />
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
        error={
          quickSetup.setupError
            ? recoveryMessage(
                locale,
                state.customizer.candidateFeedback?.failure ?? { code: 'setup-rejected' },
              )
            : undefined
        }
        recoveryFailure={
          quickSetup.setupError
            ? (state.customizer.candidateFeedback?.failure ?? { code: 'setup-rejected' })
            : undefined
        }
        onClose={quickSetup.closeSetup}
        onApply={quickSetup.applySetup}
        initialText={
          !quickSetup.setupReopened && routeModel.setupText
            ? routeModel.setupText
            : state.customizer.params.text
        }
        supportsKeyring={
          TEMPLATE_CATALOG.find(
            (template) => template.id === state.customizer.acceptedParams.templateId,
          )?.supportsKeyring ?? false
        }
        templateId={state.customizer.acceptedParams.templateId}
        styleId={state.customizer.acceptedParams.styleId}
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
        initialSize={
          state.customizer.acceptedParams.sizeEnvelope ??
          (quickSetup.setupReopened ? suggestedSizeEnvelope(acceptedMetrics) : undefined)
        }
        initialFavoriteCategories={quickSetup.favoriteFontCategories}
        acceptedMetrics={acceptedMetrics}
        acceptedText={state.customizer.acceptedParams.text}
      />
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
        onClose={closeExport}
        onExportSuccess={(format) =>
          exportFeedback.onExportSuccess({
            format,
            template: state.customizer.acceptedParams.templateId,
            designUrl: exportedDesignUrl(),
          })
        }
        successContent={
          exportFeedback.prompt ? (
            <ExportFeedback
              locale={locale}
              lastExport={exportFeedback.prompt}
              onSubmit={exportFeedback.submit}
            />
          ) : undefined
        }
        disconnectedExportAcknowledged={state.disconnectedExportAcknowledged}
        onDisconnectedExportAcknowledged={state.setDisconnectedExportAcknowledged}
      />
      {/* Hidden, not unmounted, under dialogs so an answered check stays answered. */}
      {printCheck.lastExport && (
        <PrintCheckNotice
          locale={locale}
          lastExport={printCheck.lastExport}
          hidden={state.exportOpen || quickSetup.setupOpen}
          onSubmit={printCheck.submit}
          onDismiss={printCheck.dismiss}
        />
      )}
    </main>
  );
};

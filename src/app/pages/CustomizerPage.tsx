import { t, type Locale } from '../../infrastructure/i18n';
import { useLocation } from 'react-router';
import {
  DEFAULT_PARAMS,
  normalizeParams,
  TEMPLATE_CATALOG,
  type KeychainParams,
  type TemplateId,
  applyPrintAppearanceOverrides,
  decodeDesignDocument,
} from '../../domain/keychain';
import { ExportDialog, buildPreflightReport } from '../../features/export';
import { AppHeader } from '../components/AppHeader';
import { CustomizerWorkspace } from '../components/CustomizerWorkspace';
import { CustomizerFooter } from '../components/CustomizerFooter';
import { Toast, type ToastVariant } from '../components/Toast';
import { useCustomizerPageState } from '../hooks/useCustomizerPageState';
import '../styles/customizer.css';
import '../styles/preview.css';
import '../styles/export.css';

export const CustomizerPage = ({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}) => {
  const location = useLocation();
  const projectParams = (location.state as { projectParams?: Record<string, unknown> } | null)
    ?.projectParams;
  const searchParams = new URLSearchParams(location.search);
  const designValue = searchParams.get('design');
  const sharedDocument = designValue ? decodeDesignDocument(designValue) : undefined;
  const hasInvalidDesign = searchParams.has('design') && !sharedDocument;
  const sharedFontFallback = Boolean(sharedDocument?.fontFallback);
  const requestedTemplate = searchParams.get('template');
  const templateId = TEMPLATE_CATALOG.some((template) => template.id === requestedTemplate)
    ? (requestedTemplate as TemplateId)
    : undefined;
  const initialParams: KeychainParams | undefined =
    sharedDocument?.params ??
    (projectParams
      ? normalizeParams({ ...DEFAULT_PARAMS, ...projectParams } as KeychainParams)
      : templateId
        ? normalizeParams({ ...DEFAULT_PARAMS, templateId })
        : undefined);
  const state = useCustomizerPageState(
    locale,
    initialParams,
    sharedDocument?.appearanceOverrides,
    designValue ?? undefined,
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
      {(hasInvalidDesign ||
        sharedFontFallback ||
        state.shareFontFallback ||
        state.shareStatus !== 'idle' ||
        state.randomizeFailure) &&
        (() => {
          const variant: ToastVariant = hasInvalidDesign
            ? 'error'
            : state.randomizeFailure
              ? 'error'
              : state.shareStatus === 'failed'
                ? 'error'
                : state.shareStatus === 'manual'
                  ? 'manual'
                  : 'success';
          const message = hasInvalidDesign
            ? t(locale, 'shareInvalid')
            : state.randomizeFailure
              ? t(locale, 'randomizeFailed')
              : state.shareStatus === 'failed'
                ? t(locale, 'shareFailed')
                : state.shareStatus === 'manual'
                  ? t(locale, 'shareManual')
                  : sharedFontFallback || state.shareFontFallback
                    ? t(locale, 'shareFontFallback')
                    : t(locale, 'shareCopied');

          return <Toast variant={variant}>{message}</Toast>;
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

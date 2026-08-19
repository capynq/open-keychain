import type { Locale } from '../../infrastructure/i18n';
import { useLocation } from 'react-router';
import {
  DEFAULT_PARAMS,
  normalizeParams,
  TEMPLATE_CATALOG,
  type KeychainParams,
  type TemplateId,
} from '../../domain/keychain';
import { ExportDialog } from '../../features/export';
import { AppHeader } from '../components/AppHeader';
import { CustomizerOnboarding } from '../components/CustomizerOnboarding';
import { CustomizerWorkspace } from '../components/CustomizerWorkspace';
import { CustomizerFooter } from '../components/CustomizerFooter';
import { useCustomizerPageState } from '../hooks/useCustomizerPageState';

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
  const requestedTemplate = new URLSearchParams(location.search).get('template');
  const templateId = TEMPLATE_CATALOG.some((template) => template.id === requestedTemplate)
    ? (requestedTemplate as TemplateId)
    : undefined;
  const initialParams: KeychainParams | undefined = projectParams
    ? normalizeParams({ ...DEFAULT_PARAMS, ...projectParams } as KeychainParams)
    : templateId
      ? normalizeParams({ ...DEFAULT_PARAMS, templateId })
      : undefined;
  const state = useCustomizerPageState(locale, initialParams);

  return (
    <main className="app-shell" aria-label="Customizer">
      <AppHeader
        variant="customizer"
        locale={locale}
        onLocaleChange={onLocaleChange}
        exportOpen={state.exportOpen}
        onExportOpen={() => state.setExportOpen(true)}
        hosted={state.hosted}
        currentParams={state.customizer.params}
      />
      <CustomizerOnboarding
        locale={locale}
        guide={state.guide}
        printable={state.exportState.printable}
        onExportOpen={() => state.setExportOpen(true)}
      />
      <CustomizerWorkspace locale={locale} state={state} />
      <CustomizerFooter locale={locale} />
      <ExportDialog
        locale={locale}
        open={state.exportOpen}
        exportState={state.exportState}
        onClose={() => state.setExportOpen(false)}
      />
    </main>
  );
};

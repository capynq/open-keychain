import type { Locale } from '../../infrastructure/i18n';
import { ExportDialog } from '../../features/export';
import { AppHeader } from '../components/AppHeader';
import { CustomizerWorkspace } from '../components/CustomizerWorkspace';
import { useCustomizerPageState } from '../hooks/useCustomizerPageState';

export const CustomizerPage = ({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}) => {
  const state = useCustomizerPageState(locale);

  return (
    <main className="app-shell" aria-label="Customizer">
      <AppHeader
        variant="customizer"
        locale={locale}
        onLocaleChange={onLocaleChange}
        exportOpen={state.exportOpen}
        onExportOpen={() => state.setExportOpen(true)}
        hosted={state.hosted}
      />
      <CustomizerWorkspace locale={locale} state={state} />
      <ExportDialog
        locale={locale}
        open={state.exportOpen}
        exportState={state.exportState}
        onClose={() => state.setExportOpen(false)}
      />
    </main>
  );
};

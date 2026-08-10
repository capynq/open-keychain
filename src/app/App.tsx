import { useEffect, useState } from 'react';
import { DEFAULT_PARAMS, normalizeParams } from '../domain/keychain';
import { detectLocale, issueMessage, t, type Locale } from '../infrastructure/i18n';
import { AppHeader } from './components/AppHeader';
import { PreviewPanel } from './components/PreviewPanel';
import { ControlsPanel, useCustomizerParams, useGeometryGeneration, useHostedAccount } from '../features/customizer';
import { ExportDialog, useExportActions } from '../features/export';
import type { SurfacePresetId } from '../features/preview';
import './styles/app.css';

const App = () => {
  const [locale, setLocale] = useState<Locale>(detectLocale);
  const [surfacePreset, setSurfacePreset] = useState<SurfacePresetId>(
    () => (localStorage.getItem('open-keychain-surface') as SurfacePresetId) || 'matte',
  );
  const [exportOpen, setExportOpen] = useState(false);
  const customizer = useCustomizerParams();
  const geometry = useGeometryGeneration(customizer.params);
  const hosted = useHostedAccount(customizer.params, (projectParams) => {
    customizer.setParams(normalizeParams({ ...DEFAULT_PARAMS, ...projectParams }));
  });
  const { downloading, download } = useExportActions(
    geometry.clientRef,
    geometry.result,
    customizer.params,
    geometry.setError,
  );
  useEffect(() => {
    if (!exportOpen) return;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setExportOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [exportOpen]);
  useEffect(() => {
    localStorage.setItem('open-keychain-locale', locale);
  }, [locale]);
  useEffect(() => {
    localStorage.setItem('open-keychain-surface', surfacePreset);
  }, [surfacePreset]);
  const errorIssue = geometry.result?.issues.find((item) => item.severity === 'error');
  const warningIssue = geometry.result?.issues.find((item) => item.severity === 'warning');
  const needsAttention = Boolean(
    geometry.error || (!geometry.busy && geometry.result && (!geometry.result.printable || errorIssue)),
  );
  const statusClass = geometry.busy ? 'updating' : needsAttention ? 'attention' : warningIssue ? 'adjusted' : 'ready';
  const statusText = geometry.busy
    ? t(locale, 'updating')
    : needsAttention
      ? t(locale, 'needsAttention')
      : warningIssue
        ? t(locale, 'adjusted')
        : t(locale, 'ready');
  const feedback =
    geometry.error ??
    (errorIssue
      ? issueMessage(locale, errorIssue)
      : warningIssue
        ? issueMessage(locale, warningIssue)
        : !geometry.busy && geometry.result && !geometry.result.printable
          ? t(locale, 'errorNotReady')
          : undefined);
  return (
    <main className="app-shell">
      <AppHeader
        locale={locale}
        onLocaleChange={setLocale}
        exportOpen={exportOpen}
        onExportOpen={() => setExportOpen(true)}
        account={hosted.account}
        projects={hosted.projects}
        accountOpen={hosted.accountOpen}
        onAccountToggle={() => hosted.setAccountOpen(!hosted.accountOpen)}
        authMode={hosted.authMode}
        authName={hosted.authName}
        authEmail={hosted.authEmail}
        authPassword={hosted.authPassword}
        authBusy={hosted.authBusy}
        authError={hosted.authError}
        setAuthMode={hosted.setAuthMode}
        setAuthName={hosted.setAuthName}
        setAuthEmail={hosted.setAuthEmail}
        setAuthPassword={hosted.setAuthPassword}
        submitAuth={hosted.submitAuth}
        saveCurrentProject={hosted.saveCurrentProject}
        loadProject={hosted.loadProject}
        logOut={hosted.logOut}
      />
      <div className="workspace">
        <ControlsPanel
          locale={locale}
          params={customizer.params}
          selectedFont={customizer.selectedFont}
          availableStyles={customizer.availableStyles}
          usesCyrillic={customizer.usesCyrillic}
          fontNotice={customizer.fontNotice}
          surfacePreset={surfacePreset}
          onSurfaceChange={setSurfacePreset}
          update={customizer.update}
          updateText={customizer.updateText}
          selectTemplate={customizer.selectTemplate}
          showsParameter={customizer.showsParameter}
        />
        <PreviewPanel
          locale={locale}
          text={customizer.params.text}
          result={geometry.result}
          busy={geometry.busy}
          surfacePreset={surfacePreset}
          feedback={feedback}
          statusClass={statusClass}
          statusText={statusText}
        />
      </div>
      <ExportDialog
        locale={locale}
        open={exportOpen}
        printable={Boolean(geometry.result?.printable)}
        downloading={downloading}
        onClose={() => setExportOpen(false)}
        onDownload={(format, mode) => {
          setExportOpen(false);
          void download(format, mode);
        }}
      />
    </main>
  );
};

export default App;

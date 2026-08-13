import { useEffect, useState } from 'react';
import { DEFAULT_PARAMS, normalizeParams } from '../domain/keychain';
import { detectLocale, type Locale } from '../infrastructure/i18n';
import { AppHeader } from './components/AppHeader';
import { PreviewPanel } from './components/PreviewPanel';
import { ControlsPanel, useCustomizerParams, useGeometryGeneration } from '../features/customizer';
import { ExportDialog, useExportActions } from '../features/export';
import { useHostedAccount } from '../features/hosted';
import { previewStatus, type SurfacePresetId } from '../features/preview';
import './styles/app.css';

const App = () => {
  const [locale, setLocale] = useState<Locale>(detectLocale);
  const [surfacePreset, setSurfacePreset] = useState<SurfacePresetId>('matte');
  const [exportOpen, setExportOpen] = useState(false);

  const customizer = useCustomizerParams();

  const geometry = useGeometryGeneration(customizer.params);

  const hosted = useHostedAccount(customizer.params, (projectParams) => {
    customizer.setParams(normalizeParams({ ...DEFAULT_PARAMS, ...projectParams }));
  });

  const exportState = useExportActions({ geometry, params: customizer.params });

  useEffect(() => {
    if (!exportOpen) return;
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setExportOpen(false);
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [exportOpen]);

  const status = previewStatus(geometry, locale);

  return (
    <main className="app-shell">
      <AppHeader
        locale={locale}
        onLocaleChange={setLocale}
        exportOpen={exportOpen}
        onExportOpen={() => setExportOpen(true)}
        hosted={hosted}
      />
      <div className="workspace">
        <ControlsPanel
          locale={locale}
          customizer={customizer}
          surfacePreset={surfacePreset}
          onSurfaceChange={setSurfacePreset}
          onReset={() => {
            customizer.reset();
            setSurfacePreset('matte');
          }}
        />
        <PreviewPanel
          locale={locale}
          geometry={geometry}
          surfacePreset={surfacePreset}
          status={status}
        />
      </div>
      <ExportDialog
        locale={locale}
        open={exportOpen}
        exportState={exportState}
        onClose={() => setExportOpen(false)}
      />
    </main>
  );
};

export default App;

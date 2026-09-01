import type { Locale } from '../../../infrastructure/i18n';
import type { CustomizerPageState } from '../../hooks/useCustomizerPageState';

import { ControlsPanel } from '../../../features/customizer';
import { useAnalytics } from '../../../infrastructure/telemetry';
import { PreviewPanel } from '../PreviewPanel/PreviewPanel';
import './CustomizerWorkspace.module.css';

export const CustomizerWorkspace = ({
  locale,
  state,
}: {
  locale: Locale;
  state: CustomizerPageState;
}) => {
  const { track } = useAnalytics();
  const setSurface = (preset: CustomizerPageState['surfacePreset']): void => {
    state.setSurfacePreset(preset);
    track('surface_preset_changed', { preset });
  };

  return (
    <div className="workspace">
      <ControlsPanel
        locale={locale}
        customizer={state.customizer}
        onReset={() => {
          state.customizer.reset();
          state.setAppearanceOverrides({ version: 1 });
          setSurface('matte');
        }}
      />
      <PreviewPanel
        locale={locale}
        geometry={state.geometry}
        surfacePreset={state.surfacePreset}
        status={state.status}
        exportOpen={state.exportOpen}
        modelInfo={state.modelInfo}
        onSurfaceChange={setSurface}
        onSurfaceReset={() => setSurface('matte')}
        appearanceOverrides={state.appearanceOverrides}
        onAppearanceChange={state.setAppearanceOverrides}
      />
    </div>
  );
};

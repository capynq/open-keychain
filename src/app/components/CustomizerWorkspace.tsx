import { ControlsPanel } from '../../features/customizer';
import type { Locale } from '../../infrastructure/i18n';
import { PreviewPanel } from './PreviewPanel';
import type { CustomizerPageState } from '../hooks/useCustomizerPageState';

export const CustomizerWorkspace = ({
  locale,
  state,
}: {
  locale: Locale;
  state: CustomizerPageState;
}) => (
  <div className="workspace">
    <ControlsPanel
      locale={locale}
      customizer={state.customizer}
      onReset={() => {
        state.customizer.reset();
        state.setSurfacePreset('matte');
      }}
    />
    <PreviewPanel
      locale={locale}
      geometry={state.geometry}
      surfacePreset={state.surfacePreset}
      status={state.status}
      modelInfo={state.modelInfo}
      onSurfaceChange={state.setSurfacePreset}
      onSurfaceReset={() => state.setSurfacePreset('matte')}
    />
  </div>
);

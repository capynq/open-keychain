import { ControlsPanel } from '../../features/customizer';
import type { Locale } from '../../infrastructure/i18n';
import { useAnalytics } from '../../infrastructure/telemetry';
import { PreviewPanel } from './PreviewPanel';
import type { CustomizerPageState } from '../hooks/useCustomizerPageState';

export const CustomizerWorkspace = ({
  locale,
  state,
}: {
  locale: Locale;
  state: CustomizerPageState;
}) => <WorkspaceContent locale={locale} state={state} />;

const WorkspaceContent = ({ locale, state }: { locale: Locale; state: CustomizerPageState }) => {
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
        onNameEdited={state.guide.markNameEdited}
        onTemplateSelected={state.guide.markTemplateEdited}
        onReset={() => {
          state.customizer.reset();
          setSurface('matte');
        }}
      />
      <PreviewPanel
        locale={locale}
        geometry={state.geometry}
        surfacePreset={state.surfacePreset}
        status={state.status}
        modelInfo={state.modelInfo}
        onSurfaceChange={setSurface}
        onSurfaceReset={() => setSurface('matte')}
      />
    </div>
  );
};

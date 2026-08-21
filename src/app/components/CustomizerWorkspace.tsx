import { ControlsPanel } from '../../features/customizer';
import type { Locale } from '../../infrastructure/i18n';
import { useAnalytics } from '../../infrastructure/telemetry';
import { PreviewPanel } from './PreviewPanel';
import type { CustomizerPageState } from '../hooks/useCustomizerPageState';
import { DEFAULT_PARAMS, normalizeParams, type DesignRecipe } from '../../domain/keychain';

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
        onRecipeSelected={(recipe: DesignRecipe) => {
          state.customizer.setParams((current) =>
            normalizeParams({
              ...DEFAULT_PARAMS,
              text: current.text,
              ...recipe.params,
              fontId: recipe.fontId,
            }),
          );
          state.guide.markTemplateEdited();
        }}
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
        modelInfo={state.modelInfo}
        onSurfaceChange={setSurface}
        onSurfaceReset={() => setSurface('matte')}
        appearanceOverrides={state.appearanceOverrides}
        onAppearanceChange={state.setAppearanceOverrides}
      />
    </div>
  );
};

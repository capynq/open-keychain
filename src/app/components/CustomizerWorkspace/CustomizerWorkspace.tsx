import type { FontCategory } from '../../../domain/keychain/fonts/catalog';
import type { Locale } from '../../../infrastructure/i18n/config';
import type { CustomizerPageState } from '../../hooks/useCustomizerPageState';

import { ControlsPanel } from '../../../features/customizer/components/ControlsPanel/ControlsPanel';
import { useAnalytics } from '../../../infrastructure/telemetry/useTelemetry';
import { PreviewPanel } from '../PreviewPanel/PreviewPanel';
import './CustomizerWorkspace.module.css';

export const CustomizerWorkspace = ({
  locale,
  state,
  favoriteFontCategories,
}: {
  locale: Locale;
  state: CustomizerPageState;
  favoriteFontCategories?: FontCategory[];
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
        favoriteFontCategories={favoriteFontCategories}
        appearanceOverrides={state.appearanceOverrides}
        onAppearanceChange={state.setAppearanceOverrides}
        baseColor={state.geometry.result?.appearance.base.color}
        reliefColor={state.geometry.result?.appearance.relief.color}
        parameterLimits={
          state.geometry.current === false ? undefined : state.geometry.result?.parameterLimits
        }
        baseFinishLimits={state.geometry.result?.baseFinishLimits}
        textFinishLimits={state.geometry.result?.textFinishLimits}
      />
      <PreviewPanel
        locale={locale}
        geometry={{ ...state.geometry, sizeEnvelope: state.customizer.acceptedParams.sizeEnvelope }}
        surfacePreset={state.surfacePreset}
        status={state.status}
        exportOpen={state.exportOpen}
        onReviewIssue={() => {
          const controls = document.querySelector<HTMLElement>('.controls-panel');

          const section =
            controls?.querySelector<HTMLElement>(
              state.status.fixTarget === 'print'
                ? '[data-control-group="print"]'
                : state.status.fixTarget === 'design'
                  ? '[data-control-group="refine"]'
                  : '[data-control-group="name"]',
            ) ?? controls;

          section?.scrollIntoView({ block: 'start' });
          section
            ?.querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled)')
            ?.focus();
        }}
        modelInfo={state.modelInfo}
        photoDesign={state.customizer.acceptedParams}
        appearanceOverrides={state.appearanceOverrides}
        onSurfaceChange={setSurface}
        onSurfaceReset={() => setSurface('matte')}
      />
    </div>
  );
};

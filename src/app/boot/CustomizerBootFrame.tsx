import { CustomizerFooter } from '@/app/components/CustomizerFooter/CustomizerFooter';
import { CustomizerNavigationHeader } from '@/app/components/CustomizerNavigationHeader/CustomizerNavigationHeader';
import { PreviewPanel } from '@/app/components/PreviewPanel/PreviewPanel';
import { DEFAULT_PARAMS, normalizeParams, type TemplateId } from '@/domain/keychain/model/types';
import { TEMPLATE_CATALOG } from '@/domain/keychain/templates/template-builder';
import { ControlsPanel } from '@/features/customizer/components/ControlsPanel/ControlsPanel';
import { useCustomizerParams } from '@/features/customizer/hooks/useCustomizerParams';
import { previewStatus } from '@/features/preview/model/preview-status';
import { styleName, templateName, type Locale } from '@/infrastructure/i18n';
import '@/app/styles/customizer.css';
import '@/app/styles/preview.css';

import './CustomizerBootFrame.css';

const BOOT_STYLE = { version: 1 } as const;
const noop = (): void => {};

export const CustomizerBootFrame = ({
  locale,
  templateId = 'name-keychain',
  neutral = false,
}: {
  locale: Locale;
  templateId?: TemplateId;
  neutral?: boolean;
}) => {
  const params = normalizeParams({
    ...DEFAULT_PARAMS,
    templateId,
    ...(neutral ? { text: '', subtitle: '' } : {}),
  });
  const customizer = useCustomizerParams(params);
  const activeTemplate = TEMPLATE_CATALOG.find((template) => template.id === templateId)!;
  const activeStyle = customizer.availableStyles.find(
    (style) => style.id === customizer.params.styleId,
  );
  const geometry = { result: undefined, busy: true, error: undefined, current: false };
  const modelInfo = {
    templateId,
    template: templateName(locale, templateId, activeTemplate.name),
    style: activeStyle ? styleName(locale, params.styleId, activeStyle.name) : undefined,
    font: customizer.selectedFont.name,
  };

  return (
    <main className="app-shell customizer-boot-frame" aria-label="Customizer">
      <CustomizerNavigationHeader
        locale={locale}
        onLocaleChange={noop}
        exportOpen={false}
        exportDisabled
        currentParams={params}
      />
      <div className="workspace">
        <ControlsPanel
          locale={locale}
          customizer={customizer}
          onReset={noop}
          bootFrame
          neutralSelection={neutral}
        />
        <PreviewPanel
          locale={locale}
          geometry={geometry}
          surfacePreset="matte"
          status={previewStatus(geometry, locale)}
          exportOpen={false}
          modelInfo={modelInfo}
          onSurfaceChange={noop}
          onSurfaceReset={noop}
          appearanceOverrides={BOOT_STYLE}
          onAppearanceChange={noop}
          neutralSummary={neutral}
        />
      </div>
      <CustomizerFooter locale={locale} />
    </main>
  );
};

import {
  FONT_CATALOG,
  fontSupportsArticulatedName,
  fontSupportsText,
  TEMPLATE_CATALOG,
} from '../../../domain/keychain';
import type { KeychainParams } from '../../../domain/keychain';
import { styleName, templateName, t, type Locale } from '../../../infrastructure/i18n';
import type { SurfacePresetId } from '../../preview';
import { PARAMETER_RANGES, type useCustomizerParams } from '../hooks/useCustomizerParams';
import { RangeControl } from './RangeControl';

export const ControlsPanel = ({
  locale,
  customizer: {
    params,
    selectedFont,
    availableStyles,
    usesCyrillic,
    fontNotice,
    update,
    updateText,
    selectTemplate,
    showsParameter,
  },
  surfacePreset,
  onSurfaceChange,
}: {
  locale: Locale;
  customizer: ReturnType<typeof useCustomizerParams>;
  surfacePreset: SurfacePresetId;
  onSurfaceChange: (preset: SurfacePresetId) => void;
}) => (
  <aside className="controls-panel">
    <section className="control-section">
      <h2>{t(locale, 'name')}</h2>
      <label className="text-input">
        <span className="sr-only">Name or text</span>
        <input
          aria-label="Name or text"
          value={params.text}
          maxLength={24}
          onChange={(event) => updateText(event.target.value)}
          placeholder={t(locale, 'namePlaceholder')}
        />
      </label>
    </section>
    <section className="control-section">
      <h2>{t(locale, 'template')}</h2>
      <div className="card-grid template-grid">
        {TEMPLATE_CATALOG.map((template) => (
          <button
            type="button"
            key={template.id}
            className={`choice-card ${params.templateId === template.id ? 'selected' : ''}`}
            onClick={() => selectTemplate(template.id)}
          >
            <span className={`style-swatch template-${template.id}`} />
            <strong>{templateName(locale, template.id, template.name)}</strong>
          </button>
        ))}
      </div>
    </section>
    {availableStyles.length > 0 && (
      <section className="control-section">
        <h2>{t(locale, 'style')}</h2>
        <div className="card-grid">
          {availableStyles.map((style) => (
            <button
              type="button"
              key={style.id}
              className={`choice-card ${params.styleId === style.id ? 'selected' : ''}`}
              onClick={() => update('styleId', style.id as KeychainParams['styleId'])}
            >
              <span className={`style-swatch style-${style.id}`} />
              <strong>{styleName(locale, style.id, style.name)}</strong>
            </button>
          ))}
        </div>
      </section>
    )}
    <section className="control-section">
      <h2>
        {t(locale, 'font')} <span className="selected-note">{selectedFont.name}</span>
      </h2>
      <div
        className={`font-grid ${params.templateId === 'articulated-name' ? 'articulated-font-grid' : ''}`}
      >
        {FONT_CATALOG.filter((font) =>
          params.templateId === 'articulated-name'
            ? fontSupportsArticulatedName(font, params.text)
            : fontSupportsText(font, params.text),
        ).map((font) => (
          <button
            type="button"
            key={font.id}
            className={`font-card ${params.fontId === font.id ? 'selected' : ''}`}
            onClick={() => update('fontId', font.id)}
            title={font.name}
          >
            <span style={{ fontFamily: font.previewFamily, fontWeight: font.weight }}>
              {usesCyrillic ? font.sampleCyrillic : font.sampleLatin}
            </span>
            <small>{font.name}</small>
          </button>
        ))}
      </div>
      {fontNotice && (
        <p className="font-notice" aria-live="polite">
          {t(locale, fontNotice.articulated ? 'fontArticulatedFallback' : 'fontFallback', {
            font: fontNotice.font,
            replacement: fontNotice.replacement,
          })}
        </p>
      )}
    </section>
    <section className="control-section">
      <h2>{t(locale, 'surface')}</h2>
      <div className="surface-grid">
        {(['matte', 'graph', 'dark', 'wood', 'metal'] as SurfacePresetId[]).map((preset) => (
          <button
            type="button"
            key={preset}
            className={surfacePreset === preset ? 'selected' : ''}
            onClick={() => onSurfaceChange(preset)}
          >
            {t(locale, preset)}
          </button>
        ))}
      </div>
    </section>
    <section className="control-section">
      <h2>{t(locale, 'shape')}</h2>
      <div className="range-grid">
        {showsParameter('textHeightMm') && (
          <RangeControl
            label={t(locale, 'nameHeight')}
            value={params.textHeightMm}
            {...PARAMETER_RANGES.textHeightMm}
            onChange={(value) => update('textHeightMm', value)}
          />
        )}
        {showsParameter('baseThicknessMm') && (
          <RangeControl
            label={t(
              locale,
              params.templateId === 'nameplate' ? 'plateThickness' : 'baseThickness',
            )}
            value={params.baseThicknessMm}
            {...(params.templateId === 'articulated-name'
              ? { ...PARAMETER_RANGES.baseThicknessMm, min: 3.4 }
              : PARAMETER_RANGES.baseThicknessMm)}
            onChange={(value) => update('baseThicknessMm', value)}
          />
        )}
        {showsParameter('reliefDepthMm') && (
          <RangeControl
            label={t(locale, params.templateId === 'nameplate' ? 'textLift' : 'raisedText')}
            value={params.reliefDepthMm}
            {...PARAMETER_RANGES.reliefDepthMm}
            onChange={(value) => update('reliefDepthMm', value)}
          />
        )}
        {showsParameter('paddingMm') && (
          <RangeControl
            label={t(locale, 'borderPadding')}
            value={params.paddingMm}
            {...PARAMETER_RANGES.paddingMm}
            onChange={(value) => update('paddingMm', value)}
          />
        )}
        {showsParameter('letterSpacingMm') && (
          <RangeControl
            label={t(locale, 'letterSpacing')}
            value={params.letterSpacingMm}
            {...PARAMETER_RANGES.letterSpacingMm}
            onChange={(value) => update('letterSpacingMm', value)}
          />
        )}
        {showsParameter('holeDiameterMm') && (
          <RangeControl
            label={t(locale, 'keyringHole')}
            value={params.holeDiameterMm}
            {...PARAMETER_RANGES.holeDiameterMm}
            onChange={(value) => update('holeDiameterMm', value)}
          />
        )}
        {params.templateId === 'articulated-name' && (
          <>
            <RangeControl
              label={t(locale, 'connectorWidth')}
              value={params.connectorWidthMm}
              {...PARAMETER_RANGES.connectorWidthMm}
              onChange={(value) => update('connectorWidthMm', value)}
            />
            <RangeControl
              label={t(locale, 'jointClearance')}
              value={params.jointClearanceMm}
              {...PARAMETER_RANGES.jointClearanceMm}
              onChange={(value) => update('jointClearanceMm', value)}
            />
            <RangeControl
              label={t(locale, 'mechanicalGap')}
              value={params.mechanicalGapMm}
              {...PARAMETER_RANGES.mechanicalGapMm}
              onChange={(value) => update('mechanicalGapMm', value)}
            />
            <RangeControl
              label={t(locale, 'maxJointAngle')}
              value={params.maxJointAngleDeg}
              {...PARAMETER_RANGES.maxJointAngleDeg}
              onChange={(value) => update('maxJointAngleDeg', value)}
            />
          </>
        )}
        {showsParameter('cornerRadiusMm') && (
          <RangeControl
            label={t(locale, 'cornerRadius')}
            value={params.cornerRadiusMm}
            {...PARAMETER_RANGES.cornerRadiusMm}
            onChange={(value) => update('cornerRadiusMm', value)}
          />
        )}
        {showsParameter('nameplateTiltDeg') && (
          <RangeControl
            label={t(locale, 'textTilt')}
            value={params.nameplateTiltDeg}
            {...PARAMETER_RANGES.nameplateTiltDeg}
            onChange={(value) => update('nameplateTiltDeg', value)}
          />
        )}
        {showsParameter('nameplateEmbedMm') && (
          <RangeControl
            label={t(locale, 'embedDepth')}
            value={params.nameplateEmbedMm}
            {...PARAMETER_RANGES.nameplateEmbedMm}
            onChange={(value) => update('nameplateEmbedMm', value)}
          />
        )}
        {showsParameter('stakeLengthMm') && (
          <RangeControl
            label={t(locale, 'stakeLength')}
            value={params.stakeLengthMm}
            {...PARAMETER_RANGES.stakeLengthMm}
            onChange={(value) => update('stakeLengthMm', value)}
          />
        )}
      </div>
    </section>
    <div className="controls-scroll-spacer" aria-hidden="true" />
  </aside>
);

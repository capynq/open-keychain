import type { KeychainParams } from '@/domain/keychain/model/types';
import type { Locale } from '@/infrastructure/i18n/config';

import {
  EDGE_FINISH_GRID_MM,
  edgeFinishPreset,
  normalizeEdgeFinish,
} from '@/domain/keychain/model/edge-finish';
import { t } from '@/infrastructure/i18n/utils';

import { RangeControl } from '../RangeControl/RangeControl';

const EDGE_PROFILES = ['sharp', 'chamfer', 'round'] as const;
type EdgeProfile = (typeof EDGE_PROFILES)[number];

const profilePath = (style: EdgeProfile, top: number, bottom: number): string => {
  const radius = style === 'sharp' ? 0 : style === 'round' ? Math.min(22, top * 18) : top * 14;
  const lowerRadius =
    style === 'sharp' ? 0 : style === 'round' ? Math.min(22, bottom * 18) : bottom * 14;
  return style === 'chamfer'
    ? `M ${20 + radius} 20 H ${240 - radius} L 240 ${20 + radius} V ${90 - lowerRadius} L ${240 - lowerRadius} 90 H ${20 + lowerRadius} L 20 ${90 - lowerRadius} V ${20 + radius} Z`
    : `M ${20 + radius} 20 H ${240 - radius} Q 240 20 240 ${20 + radius} V ${90 - lowerRadius} Q 240 90 ${240 - lowerRadius} 90 H ${20 + lowerRadius} Q 20 90 20 ${90 - lowerRadius} V ${20 + radius} Q 20 20 ${20 + radius} 20 Z`;
};

const EdgeDiagram = ({
  style,
  top,
  bottom,
  textEdge,
  large = false,
  label,
}: {
  style: EdgeProfile;
  top: number;
  bottom: number;
  textEdge: number;
  large?: boolean;
  label: string;
}) => (
  <svg
    className={
      large ? 'geometry-finish-diagram geometry-finish-diagram-large' : 'geometry-finish-diagram'
    }
    viewBox="0 0 260 110"
    role="img"
    aria-label={label}
  >
    <path
      d={profilePath(style, top, bottom)}
      fill="var(--color-terracotta)"
      stroke="var(--color-slate)"
      strokeWidth={large ? 1.5 : 1.25}
    />
    <path
      d={`M ${82 + textEdge * 3} ${18 - textEdge * 3} H ${178 - textEdge * 3} V 38 H ${82 + textEdge * 3} Z`}
      fill="var(--color-cream)"
      stroke="var(--color-slate)"
      strokeWidth="1"
    />
    <path d="M 10 94 H 250" fill="none" stroke="var(--color-muted)" strokeWidth="1" />
  </svg>
);

export const GeometryFinishControls = ({
  locale,
  params,
  update,
}: {
  locale: Locale;
  params: KeychainParams;
  update: <K extends keyof KeychainParams>(key: K, value: KeychainParams[K]) => void;
}) => {
  if (params.templateId === 'articulated-name') return null;

  const style = params.edgeFinish ?? 'sharp';
  const top = params.topEdgeMm ?? 0;
  const bottom = params.bottomEdgeMm ?? 0;
  const textEdge = params.textEdgeMm ?? 0;
  const thickness = params.baseThicknessMm;
  const supportsVisibleBackingFinish = thickness - params.minimumWallMm >= EDGE_FINISH_GRID_MM;
  const diagramLabel = t(locale, 'geometryCrossSection');
  const applyFinish = (next: Partial<KeychainParams>): void => {
    const finish = normalizeEdgeFinish({ ...params, ...next });
    update('edgeFinish', finish.style);
    update('topEdgeMm', finish.topMm);
    update('bottomEdgeMm', finish.bottomMm);
    update('textEdgeMm', finish.textMm);
  };

  return (
    <section
      className="control-subsection geometry-finish-controls"
      data-testid="geometry-finish-settings"
    >
      <div className="geometry-finish-heading">
        <h3>{t(locale, 'geometryFinishTitle')}</h3>
        <span>{t(locale, 'geometryEdgeStyle')}</span>
      </div>
      <div
        className="geometry-finish-profiles"
        role="radiogroup"
        aria-label={t(locale, 'geometryEdgeStyle')}
      >
        {EDGE_PROFILES.map((profile) => (
          <label
            className={`geometry-finish-profile${style === profile ? ' is-selected' : ''}`}
            key={profile}
          >
            <input
              type="radio"
              name="edge-finish"
              value={profile}
              aria-label={t(locale, `geometryEdge${profile}`)}
              checked={style === profile}
              disabled={profile !== 'sharp' && !supportsVisibleBackingFinish}
              onChange={() => {
                const preset = edgeFinishPreset(profile);
                applyFinish({
                  edgeFinish: preset.style,
                  topEdgeMm: preset.topMm,
                  bottomEdgeMm: preset.bottomMm,
                  textEdgeMm: params.textEdgeMm ?? 0,
                });
              }}
            />
            <EdgeDiagram
              style={profile}
              top={style === profile ? top : profile === 'sharp' ? 0 : 0.6}
              bottom={style === profile ? bottom : profile === 'sharp' ? 0 : 0.4}
              textEdge={style === profile ? textEdge : 0}
              label={`${t(locale, `geometryEdge${profile}`)} · ${diagramLabel}`}
            />
            <strong>{t(locale, `geometryEdge${profile}`)}</strong>
          </label>
        ))}
      </div>
      <EdgeDiagram
        style={style}
        top={top}
        bottom={bottom}
        textEdge={textEdge}
        large
        label={diagramLabel}
      />
      {style !== 'sharp' && (
        <div className="geometry-finish-tune">
          <h4>{t(locale, 'geometryFineTune')}</h4>
          <div className="range-grid">
            <RangeControl
              label={t(locale, 'geometryTopEdge')}
              value={top}
              min={0}
              max={Math.max(0, Math.min(2, thickness - params.minimumWallMm - bottom))}
              step={EDGE_FINISH_GRID_MM}
              unit="mm"
              onChange={(value) => applyFinish({ topEdgeMm: value })}
            />
            <RangeControl
              label={t(locale, 'geometryBottomEdge')}
              value={bottom}
              min={0}
              max={Math.max(0, Math.min(2, thickness - params.minimumWallMm - top))}
              step={EDGE_FINISH_GRID_MM}
              unit="mm"
              onChange={(value) => applyFinish({ bottomEdgeMm: value })}
            />
            {params.templateId !== 'nameplate' && (
              <RangeControl
                label={t(locale, 'geometryTextEdge')}
                value={textEdge}
                min={0}
                max={Math.max(0, params.reliefDepthMm - 0.2)}
                step={EDGE_FINISH_GRID_MM}
                unit="mm"
                onChange={(value) => applyFinish({ textEdgeMm: value })}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
};

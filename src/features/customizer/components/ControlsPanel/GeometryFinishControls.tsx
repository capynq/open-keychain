import type { KeychainParams, GeometryResult } from '@/domain/keychain/model/types';
import type { CandidateControlGroup } from '@/features/customizer/hooks/useCustomizerParams';
import type { Locale } from '@/infrastructure/i18n/config';

import { EDGE_FINISH_GRID_MM } from '@/domain/keychain/model/edge-finish';
import { t } from '@/infrastructure/i18n/utils';

import { RangeControl } from '../RangeControl/RangeControl';

const EDGE_PROFILES = ['sharp', 'chamfer', 'round'] as const;
export const GeometryFinishControls = ({
  locale,
  params,
  baseFinishLimits,
  limits,
  updateMany,
}: {
  locale: Locale;
  params: KeychainParams;
  baseFinishLimits?: GeometryResult['baseFinishLimits'];
  limits?: GeometryResult['textFinishLimits'];
  updateMany: (changes: Partial<KeychainParams>, group?: CandidateControlGroup) => void;
}) => {
  const baseSupported = params.templateId !== 'articulated-name';
  const baseProfile = params.edgeFinish ?? 'sharp';
  const baseTop = params.topEdgeMm ?? 0;
  const baseBottom = params.bottomEdgeMm ?? 0;
  const baseTopMaximum = Math.max(
    0,
    Math.min(2, params.baseThicknessMm - params.minimumWallMm - baseBottom),
  );
  const baseBottomMaximum = Math.max(
    0,
    Math.min(2, params.baseThicknessMm - params.minimumWallMm - baseTop),
  );
  const verifiedBaseMaximum =
    baseProfile === 'round'
      ? (baseFinishLimits?.roundMaxMm ?? 0)
      : (baseFinishLimits?.chamferMaxMm ?? 0);
  const profile = params.textEdgeFinish ?? 'sharp';
  const maximum = profile === 'round' ? (limits?.roundMaxMm ?? 0) : (limits?.chamferMaxMm ?? 0);
  const unavailable =
    limits &&
    (limits.chamferMaxMm < EDGE_FINISH_GRID_MM || limits.roundMaxMm < EDGE_FINISH_GRID_MM);
  return (
    <section
      className="control-subsection geometry-finish-controls"
      data-testid="geometry-finish-settings"
    >
      <div className="geometry-finish-heading">
        <h4>{t(locale, 'geometryBaseFinishTitle')}</h4>
      </div>
      {!baseSupported ? (
        <p className="field-help">{t(locale, 'geometryBaseFinishUnavailable')}</p>
      ) : (
        <>
          <div
            className="geometry-finish-profiles"
            role="radiogroup"
            aria-label={t(locale, 'geometryBaseEdgeStyle')}
          >
            {EDGE_PROFILES.map((next) => {
              const nextMaximum =
                next === 'round'
                  ? (baseFinishLimits?.roundMaxMm ?? 0)
                  : next === 'chamfer'
                    ? (baseFinishLimits?.chamferMaxMm ?? 0)
                    : Infinity;
              return (
                <label
                  className={`geometry-finish-profile${baseProfile === next ? ' is-selected' : ''}`}
                  key={`base-${next}`}
                >
                  <input
                    type="radio"
                    data-candidate-key="edgeFinish"
                    name="base-edge-finish"
                    value={next}
                    aria-label={t(locale, `geometryEdge${next}`)}
                    checked={baseProfile === next}
                    disabled={next !== 'sharp' && nextMaximum < EDGE_FINISH_GRID_MM}
                    onChange={() =>
                      updateMany(
                        {
                          edgeFinish: next,
                          topEdgeMm: next === 'sharp' ? 0 : EDGE_FINISH_GRID_MM,
                          bottomEdgeMm: next === 'sharp' ? 0 : EDGE_FINISH_GRID_MM,
                        },
                        'print',
                      )
                    }
                  />
                  <strong>{t(locale, `geometryEdge${next}`)}</strong>
                </label>
              );
            })}
          </div>
          {baseProfile !== 'sharp' && verifiedBaseMaximum >= EDGE_FINISH_GRID_MM && (
            <div className="geometry-finish-tune">
              <div className="range-grid">
                <RangeControl
                  candidateKey="topEdgeMm"
                  label={t(locale, 'geometryBaseTopEdge')}
                  value={baseTop}
                  min={0}
                  max={Math.min(baseTopMaximum, verifiedBaseMaximum)}
                  step={EDGE_FINISH_GRID_MM}
                  unit="mm"
                  onChange={(value) => updateMany({ topEdgeMm: value }, 'print')}
                />
                <RangeControl
                  candidateKey="bottomEdgeMm"
                  label={t(locale, 'geometryBaseBottomEdge')}
                  value={baseBottom}
                  min={0}
                  max={Math.min(baseBottomMaximum, verifiedBaseMaximum)}
                  step={EDGE_FINISH_GRID_MM}
                  unit="mm"
                  onChange={(value) => updateMany({ bottomEdgeMm: value }, 'print')}
                />
              </div>
            </div>
          )}
        </>
      )}
      <div className="geometry-finish-heading">
        <h4>{t(locale, 'geometryTextFinishTitle')}</h4>
      </div>
      <div
        className="geometry-finish-profiles"
        role="radiogroup"
        aria-label={t(locale, 'geometryTextEdgeStyle')}
      >
        {EDGE_PROFILES.map((next) => {
          const nextMaximum =
            next === 'sharp'
              ? Infinity
              : next === 'round'
                ? (limits?.roundMaxMm ?? 0)
                : (limits?.chamferMaxMm ?? 0);
          return (
            <label
              className={`geometry-finish-profile${profile === next ? ' is-selected' : ''}`}
              key={next}
            >
              <input
                type="radio"
                data-candidate-key="textEdgeFinish"
                name="text-edge-finish"
                value={next}
                aria-label={t(locale, `geometryTextEdge${next}`)}
                checked={profile === next}
                disabled={nextMaximum < EDGE_FINISH_GRID_MM}
                onChange={() =>
                  updateMany(
                    {
                      textEdgeFinish: next,
                      textEdgeMm: next === 'sharp' ? 0 : EDGE_FINISH_GRID_MM,
                    },
                    'print',
                  )
                }
              />
              <strong>{t(locale, `geometryTextEdge${next}`)}</strong>
            </label>
          );
        })}
      </div>
      {profile !== 'sharp' && maximum >= EDGE_FINISH_GRID_MM && (
        <div className="geometry-finish-tune">
          <RangeControl
            candidateKey="textEdgeMm"
            label={t(locale, 'geometryTextEdge')}
            value={params.textEdgeMm ?? 0}
            min={0}
            max={maximum}
            step={EDGE_FINISH_GRID_MM}
            unit="mm"
            onChange={(value) => updateMany({ textEdgeMm: value }, 'print')}
          />
        </div>
      )}
      {unavailable && <p className="field-help">{t(locale, 'textFinishUnavailable')}</p>}
    </section>
  );
};

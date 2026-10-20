import type { ReactNode } from 'react';

import { CornerDownRight, Radius, TriangleRight } from 'lucide-react';

import type { KeychainParams, GeometryResult } from '@/domain/keychain/model/types';
import type { CandidateControlGroup } from '@/features/customizer/hooks/useCustomizerParams';
import type { CandidateIntent } from '@/features/customizer/model/candidate-scheduler';
import type { Locale } from '@/infrastructure/i18n/config';

import { EDGE_FINISH_GRID_MM } from '@/domain/keychain/model/edge-finish';
import { t } from '@/infrastructure/i18n/utils';
import { useAnalytics } from '@/infrastructure/telemetry/useTelemetry';

import { RangeControl } from '../RangeControl/RangeControl';
import { FinishStrengthChoices } from './FinishStrengthChoices';
import styles from './GeometryFinishControls.module.css';
import choiceStyles from './SimpleOptions.module.css';

const EDGE_PROFILES = ['sharp', 'chamfer', 'round'] as const;
const PROFILE_ICONS = { sharp: CornerDownRight, chamfer: TriangleRight, round: Radius };
const PROFILE_DESCRIPTION_KEYS = {
  sharp: 'simpleFinishSharpDescription',
  chamfer: 'simpleFinishChamferDescription',
  round: 'simpleFinishRoundDescription',
};
export const GeometryFinishControls = ({
  locale,
  params,
  baseFinishLimits,
  limits,
  updateMany,
  simple = false,
  baseFeedback,
  textFeedback,
}: {
  locale: Locale;
  params: KeychainParams;
  baseFinishLimits?: GeometryResult['baseFinishLimits'];
  limits?: GeometryResult['textFinishLimits'];
  updateMany: (
    changes: Partial<KeychainParams>,
    group?: CandidateControlGroup,
    intent?: CandidateIntent,
  ) => void;
  simple?: boolean;
  baseFeedback?: ReactNode;
  textFeedback?: ReactNode;
}) => {
  const { track } = useAnalytics();
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
      className={`control-subsection geometry-finish-controls${simple ? '' : ` ${styles.pro}`}`}
      data-testid="geometry-finish-settings"
    >
      <div className={styles.group} data-finish-target="base">
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
                const Icon = PROFILE_ICONS[next];
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
                      onChange={() => {
                        track('customizer_option_changed', {
                          family: 'base_finish',
                          option_id: next,
                        });
                        updateMany(
                          {
                            edgeFinish: next,
                            topEdgeMm: next === 'sharp' ? 0 : EDGE_FINISH_GRID_MM,
                            bottomEdgeMm: next === 'sharp' ? 0 : EDGE_FINISH_GRID_MM,
                          },
                          'print',
                        );
                      }}
                    />
                    {simple && <Icon size={22} aria-hidden="true" />}
                    <strong>{t(locale, `geometryEdge${next}`)}</strong>
                    {simple && (
                      <small className={choiceStyles.finishDescription}>
                        {t(locale, PROFILE_DESCRIPTION_KEYS[next])}
                      </small>
                    )}
                  </label>
                );
              })}
            </div>
            {simple && baseProfile !== 'sharp' && (
              <div className={styles.strength}>
                <FinishStrengthChoices
                  locale={locale}
                  params={params}
                  target="base"
                  maximumMm={Math.min(
                    verifiedBaseMaximum,
                    Math.max(0, (params.baseThicknessMm - params.minimumWallMm) / 2),
                  )}
                  onSelect={(changes) => updateMany(changes, 'print')}
                />
              </div>
            )}
            {!simple && baseProfile !== 'sharp' && verifiedBaseMaximum >= EDGE_FINISH_GRID_MM && (
              <div className={`geometry-finish-tune ${styles.strength}`}>
                <div className="range-grid">
                  <RangeControl
                    candidateKey="topEdgeMm"
                    label={t(locale, 'geometryBaseTopEdge')}
                    value={baseTop}
                    min={0}
                    max={Math.min(baseTopMaximum, verifiedBaseMaximum)}
                    step={EDGE_FINISH_GRID_MM}
                    unit="mm"
                    onChange={(value) => updateMany({ topEdgeMm: value }, 'print', 'continuous')}
                  />
                  <RangeControl
                    candidateKey="bottomEdgeMm"
                    label={t(locale, 'geometryBaseBottomEdge')}
                    value={baseBottom}
                    min={0}
                    max={Math.min(baseBottomMaximum, verifiedBaseMaximum)}
                    step={EDGE_FINISH_GRID_MM}
                    unit="mm"
                    onChange={(value) => updateMany({ bottomEdgeMm: value }, 'print', 'continuous')}
                  />
                </div>
              </div>
            )}
          </>
        )}
        {baseFeedback}
      </div>
      <div className={styles.group} data-finish-target="text">
        <div className="geometry-finish-heading">
          <h4>{t(locale, 'geometryTextFinishTitle')}</h4>
        </div>
        <div
          className="geometry-finish-profiles"
          role="radiogroup"
          aria-label={t(locale, 'geometryTextEdgeStyle')}
        >
          {EDGE_PROFILES.map((next) => {
            const Icon = PROFILE_ICONS[next];
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
                  onChange={() => {
                    track('customizer_option_changed', {
                      family: 'text_finish',
                      option_id: next,
                    });
                    updateMany(
                      {
                        textEdgeFinish: next,
                        textEdgeMm: next === 'sharp' ? 0 : EDGE_FINISH_GRID_MM,
                      },
                      'print',
                    );
                  }}
                />
                {simple && <Icon size={22} aria-hidden="true" />}
                <strong>{t(locale, `geometryTextEdge${next}`)}</strong>
                {simple && (
                  <small className={choiceStyles.finishDescription}>
                    {t(locale, PROFILE_DESCRIPTION_KEYS[next])}
                  </small>
                )}
              </label>
            );
          })}
        </div>
        {simple && profile !== 'sharp' && (
          <div className={styles.strength}>
            <FinishStrengthChoices
              locale={locale}
              params={params}
              target="text"
              maximumMm={maximum}
              onSelect={(changes) => updateMany(changes, 'print')}
            />
          </div>
        )}
        {!simple && profile !== 'sharp' && maximum >= EDGE_FINISH_GRID_MM && (
          <div className={`geometry-finish-tune ${styles.strength}`}>
            <RangeControl
              candidateKey="textEdgeMm"
              label={t(locale, 'geometryTextEdge')}
              value={params.textEdgeMm ?? 0}
              min={0}
              max={maximum}
              step={EDGE_FINISH_GRID_MM}
              unit="mm"
              onChange={(value) => updateMany({ textEdgeMm: value }, 'print', 'continuous')}
            />
          </div>
        )}
        {unavailable && <p className="field-help">{t(locale, 'textFinishUnavailable')}</p>}
        {textFeedback}
      </div>
    </section>
  );
};

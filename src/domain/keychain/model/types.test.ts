import { describe, expect, it } from 'vitest';
import {
  hasActiveParameter,
  parameterRange,
  templateParameterKeys,
  type CustomizerParameter,
} from './parameters';
import {
  DEFAULT_PARAMS,
  DEFAULT_GEOMETRY_CONSTRAINTS,
  DEFAULT_PRINT_PROFILE,
  geometryConstraintsFor,
  keyringMetrics,
  normalizeParams,
  ringWallMm,
  sanitizeFilename,
  type KeychainParams,
} from './types';
describe('keychain parameters', () => {
  it('defines a stable print profile and derives effective geometry constraints', () => {
    expect(DEFAULT_PRINT_PROFILE.technology).toBe('fdm');
    expect(DEFAULT_PRINT_PROFILE.constraints).toEqual(DEFAULT_GEOMETRY_CONSTRAINTS);
    expect(
      geometryConstraintsFor({
        templateId: 'articulated-name',
        minimumWallMm: 1.6,
        jointClearanceMm: 0.35,
        mechanicalGapMm: 0.8,
      }),
    ).toEqual({ minimumWallMm: 1.6, minimumClearanceMm: 0.8, maximumWidthMm: 120 });
  });
  it('normalizes text and clamps consumer controls', () => {
    const result = normalizeParams({
      ...DEFAULT_PARAMS,
      text: '  José   ',
      textHeightMm: 100,
      holeDiameterMm: 0,
    });
    expect(result.text).toBe('José');
    expect(result.textHeightMm).toBe(30);
    expect(result.holeDiameterMm).toBe(3);
    expect(result.letterSpacingMm).toBe(1);
    expect(result.plantAccentEnabled).toBe(true);
    expect(
      normalizeParams({ ...DEFAULT_PARAMS, plantAccentEnabled: false }).plantAccentEnabled,
    ).toBe(false);
    expect(normalizeParams({ ...DEFAULT_PARAMS, nameplateTiltDeg: 90 }).nameplateTiltDeg).toBe(90);
    expect(normalizeParams({ ...DEFAULT_PARAMS, nameplateTiltDeg: 120 }).nameplateTiltDeg).toBe(90);
    expect(
      normalizeParams({
        ...DEFAULT_PARAMS,
        templateId: 'nameplate',
        baseThicknessMm: 1.6,
        nameplateEmbedMm: 1.8,
      }).nameplateEmbedMm,
    ).toBeCloseTo(1.3);
  });
  it('exposes only controls that affect each template', () => {
    expect(templateParameterKeys('plant-label')).not.toContain('holeDiameterMm');
    expect(templateParameterKeys('articulated-name')).not.toContain('letterSpacingMm');
    expect(templateParameterKeys('articulated-name')).not.toContain('paddingMm');
    expect(templateParameterKeys('nameplate')).toContain('cornerRadiusMm');
    expect(templateParameterKeys('nameplate')).toContain('nameplateTiltDeg');
    expect(templateParameterKeys('nameplate')).toContain('nameplateEmbedMm');
    expect(templateParameterKeys('nameplate')).not.toContain('holeDiameterMm');
    expect(templateParameterKeys('nameplate')).toContain('reliefDepthMm');
    expect(
      hasActiveParameter(
        { ...DEFAULT_PARAMS, templateId: 'plant-label', styleId: 'capsule' },
        'cornerRadiusMm',
      ),
    ).toBe(false);
    expect(
      hasActiveParameter(
        { ...DEFAULT_PARAMS, templateId: 'plant-label', styleId: 'contour' },
        'cornerRadiusMm',
      ),
    ).toBe(true);
    expect(
      parameterRange({ ...DEFAULT_PARAMS, templateId: 'articulated-name' }, 'baseThicknessMm').min,
    ).toBe(3.4);
    expect(
      parameterRange(
        { ...DEFAULT_PARAMS, templateId: 'nameplate', baseThicknessMm: 1.6 },
        'nameplateEmbedMm',
      ).max,
    ).toBeCloseTo(1.3);
  });
  it('keeps the visible parameter matrix aligned with template and style capabilities', () => {
    const parameters: readonly CustomizerParameter[] = [
      'textHeightMm',
      'fontWeightMm',
      'baseThicknessMm',
      'reliefDepthMm',
      'edgeInsetMm',
      'letterSpacingMm',
      'holeDiameterMm',
      'connectorWidthMm',
      'jointClearanceMm',
      'mechanicalGapMm',
      'maxJointAngleDeg',
      'cornerRadiusMm',
      'stakeLengthMm',
      'nameplateTiltDeg',
      'nameplateEmbedMm',
      'plantAccentEnabled',
    ];
    const active = (templateId: KeychainParams['templateId'], styleId: KeychainParams['styleId']) =>
      new Set(
        parameters.filter((parameter) =>
          hasActiveParameter({ ...DEFAULT_PARAMS, templateId, styleId }, parameter),
        ),
      );
    const expectActive = (
      templateId: KeychainParams['templateId'],
      styleId: KeychainParams['styleId'],
      expected: readonly CustomizerParameter[],
    ) => {
      expect([...active(templateId, styleId)].sort()).toEqual([...expected].sort());
    };

    expectActive('name-keychain', 'contour', [
      'textHeightMm',
      'fontWeightMm',
      'baseThicknessMm',
      'reliefDepthMm',
      'edgeInsetMm',
      'letterSpacingMm',
      'holeDiameterMm',
    ]);
    expectActive('articulated-name', 'contour', [
      'textHeightMm',
      'baseThicknessMm',
      'reliefDepthMm',
      'holeDiameterMm',
      'connectorWidthMm',
      'jointClearanceMm',
      'mechanicalGapMm',
      'maxJointAngleDeg',
    ]);
    expectActive('nameplate', 'contour', [
      'textHeightMm',
      'fontWeightMm',
      'baseThicknessMm',
      'reliefDepthMm',
      'edgeInsetMm',
      'cornerRadiusMm',
      'nameplateTiltDeg',
      'nameplateEmbedMm',
    ]);

    const plantParameters = [
      'textHeightMm',
      'fontWeightMm',
      'baseThicknessMm',
      'reliefDepthMm',
      'edgeInsetMm',
      'letterSpacingMm',
      'cornerRadiusMm',
      'stakeLengthMm',
      'plantAccentEnabled',
    ] as const;
    for (const styleId of ['contour', 'soft-tag', 'bubble', 'arch'] as const)
      expectActive('plant-label', styleId, plantParameters);
    expectActive('plant-label', 'capsule', [
      ...plantParameters.filter((parameter) => parameter !== 'cornerRadiusMm'),
    ]);
  });
  it('derives a printable ring wall', () => {
    expect(ringWallMm(3)).toBe(2.2);
    expect(ringWallMm(7)).toBeCloseTo(3.22);
    const metrics = keyringMetrics(5);
    expect(metrics.wallMm).toBeCloseTo(2.3);
    expect(metrics.outerRadiusMm).toBeCloseTo(4.8);
    expect(metrics.rootWidthMm).toBe(6);
    expect(metrics.overlapMm).toBe(5);
  });
  it('creates safe friendly filenames', () => {
    expect(sanitizeFilename('Émilie & Jo', 'soft-tag')).toBe('keychain-emilie-jo-soft-tag.stl');
    expect(sanitizeFilename('   ', 'contour')).toBe('keychain-name-contour.stl');
  });
});

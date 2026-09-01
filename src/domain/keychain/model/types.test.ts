import { describe, expect, it } from 'vitest';

import {
  hasActiveParameter,
  parameterRange,
  templateParameterKeys,
  orderedTemplateParameterKeys,
  PARAMETER_DEFINITIONS,
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
  applyPrintAppearanceOverrides,
  DEFAULT_PRINT_APPEARANCE,
  type KeychainParams,
} from './types';
describe('keychain parameters', () => {
  it('keeps Magnet roof and normalizes subtitle/ribbon scope', () => {
    const plaque = normalizeParams({
      ...DEFAULT_PARAMS,
      templateId: 'magnet',
      styleId: 'plain',
      baseThicknessMm: 1.6,
      subtitle: ' Date ',
    });
    expect(plaque.styleId).toBe('plain');
    expect(plaque.baseThicknessMm).toBe(4.4);
    expect(plaque.subtitle).toBe('Date');
    expect(plaque.subtitleGapMm).toBe(1.5);
    expect(normalizeParams({ ...plaque, subtitleGapMm: 99 }).subtitleGapMm).toBe(8);
    expect(
      normalizeParams({ ...DEFAULT_PARAMS, templateId: 'plant-label', styleId: 'ribbon' })
        .ribbonTailMm,
    ).toBe(0);
  });
  it('clears Magnet-only hardware fields outside the Magnet template', () => {
    const normalized = normalizeParams({
      ...DEFAULT_PARAMS,
      templateId: 'nameplate',
      magnetPocketPreset: '15x3',
      magnetPocketPlacement: 'right',
    });
    expect(normalized.magnetPocketPreset).toBe('10x3');
    expect(normalized.magnetPocketPlacement).toBe('center');
  });
  it('normalizes independent subtitle styling and offsets', () => {
    const normalized = normalizeParams({
      ...DEFAULT_PARAMS,
      templateId: 'nameplate',
      subtitle: '  Role  ',
      subtitleFontId: 'local-font',
      subtitleOffsetXRatio: 2,
      subtitleOffsetYRatio: -2,
      subtitleReliefDepthMm: 99,
      subtitleGapMm: 99,
    });
    expect(normalized.subtitle).toBe('Role');
    expect(normalized.subtitleFontId).toBe('local-font');
    expect(normalized.subtitleOffsetXRatio).toBe(1);
    expect(normalized.subtitleOffsetYRatio).toBe(-1);
    expect(normalized.subtitleReliefDepthMm).toBe(1.5);
    expect(normalized.subtitleGapMm).toBe(8);
    expect(normalizeParams({ ...normalized, templateId: 'articulated-name' }).subtitle).toBe('');
  });
  it('keeps the generic thickness ceiling at 4 mm', () => {
    expect(
      parameterRange({ ...DEFAULT_PARAMS, templateId: 'name-keychain' }, 'baseThicknessMm').max,
    ).toBe(4);
    expect(normalizeParams({ ...DEFAULT_PARAMS, baseThicknessMm: 5 }).baseThicknessMm).toBe(4);
  });
  it('uses a printable default font weight', () => {
    expect(DEFAULT_PARAMS.fontWeightMm).toBe(0.6);
  });

  it('applies only strict six-digit session color overrides', () => {
    expect(() =>
      applyPrintAppearanceOverrides(DEFAULT_PRINT_APPEARANCE, {
        version: 1,
        base: '#12abEF',
        relief: '#bad',
      }),
    ).toThrow('Invalid appearance color');
  });
  it('normalizes valid session colors', () => {
    expect(
      applyPrintAppearanceOverrides(DEFAULT_PRINT_APPEARANCE, {
        version: 1,
        base: '#12abEF',
      }),
    ).toEqual({
      ...DEFAULT_PRINT_APPEARANCE,
      base: { ...DEFAULT_PRINT_APPEARANCE.base, color: '#12ABEF' },
    });
  });
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
      textSizeMm: 100,
      holeDiameterMm: 0,
    });
    expect(result.text).toBe('José');
    expect(result.textSizeMm).toBe(30);
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
    expect(templateParameterKeys('magnet')).toEqual(
      expect.arrayContaining(['letterSpacingMm', 'bubbleLobeMm', 'tagTailMm', 'archCurveMm']),
    );
    expect(
      hasActiveParameter(
        { ...DEFAULT_PARAMS, templateId: 'magnet', styleId: 'ribbon' },
        'ribbonTailMm',
      ),
    ).toBe(true);
    expect(
      hasActiveParameter(
        { ...DEFAULT_PARAMS, templateId: 'magnet', styleId: 'plain' },
        'ribbonTailMm',
      ),
    ).toBe(false);
  });
  it('keeps registry dependencies before dependent randomizable parameters', () => {
    const ordered = orderedTemplateParameterKeys('nameplate');
    expect(ordered.indexOf('textSizeMm')).toBeLessThan(ordered.indexOf('paddingMm'));
    expect(ordered.indexOf('baseThicknessMm')).toBeLessThan(ordered.indexOf('reliefDepthMm'));
  });

  it('maps every registry control to its localized label key', () => {
    expect(PARAMETER_DEFINITIONS.fontWeightMm.labelKey).toBe('fontWeight');
    expect(PARAMETER_DEFINITIONS.connectorWidthMm.labelKey).toBe('connectorWidth');
    expect(PARAMETER_DEFINITIONS.nameplateTiltDeg.labelKey).toBe('textTilt');
    expect(PARAMETER_DEFINITIONS.holeDiameterMm.labelKey).toBe('keyringHole');
    expect(PARAMETER_DEFINITIONS.paddingMm.labelKey).toBe('borderPadding');
  });
  it('keeps the visible parameter matrix aligned with template and style capabilities', () => {
    const parameters: readonly CustomizerParameter[] = [
      'textSizeMm',
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
      'textSizeMm',
      'fontWeightMm',
      'baseThicknessMm',
      'reliefDepthMm',
      'edgeInsetMm',
      'letterSpacingMm',
      'holeDiameterMm',
    ]);
    expectActive('articulated-name', 'contour', [
      'textSizeMm',
      'baseThicknessMm',
      'reliefDepthMm',
      'holeDiameterMm',
      'connectorWidthMm',
      'jointClearanceMm',
      'mechanicalGapMm',
      'maxJointAngleDeg',
    ]);
    expectActive('nameplate', 'contour', [
      'textSizeMm',
      'fontWeightMm',
      'baseThicknessMm',
      'reliefDepthMm',
      'edgeInsetMm',
      'cornerRadiusMm',
      'nameplateTiltDeg',
      'nameplateEmbedMm',
    ]);

    const plantParameters = [
      'textSizeMm',
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

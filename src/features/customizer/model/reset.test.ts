import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, type KeychainParams } from '../../../domain/keychain';
import { resetParamsForSection } from './reset';

const changedParams = (): KeychainParams => ({
  ...DEFAULT_PARAMS,
  text: 'OLIVER',
  fontId: 'caveat',
  templateId: 'plant-label',
  styleId: 'bubble',
  textSizeMm: 30,
  fontWeightMm: 1.5,
  baseThicknessMm: 1.6,
  stakeLengthMm: 100,
  plantAccentEnabled: false,
});

describe('customizer section resets', () => {
  it('resets only the name', () => {
    const result = resetParamsForSection(changedParams(), 'name');

    expect(result.text).toBe(DEFAULT_PARAMS.text);
    expect(result.fontId).toBe('caveat');
    expect(result.templateId).toBe('plant-label');
  });

  it('resets template and its style context together', () => {
    const result = resetParamsForSection(changedParams(), 'template');

    expect(result.templateId).toBe(DEFAULT_PARAMS.templateId);
    expect(result.styleId).toBe(DEFAULT_PARAMS.styleId);
    expect(result.text).toBe('OLIVER');
    expect(result.fontId).toBe('caveat');
  });

  it('resets style and font independently', () => {
    const params = changedParams();
    const style = resetParamsForSection(params, 'style');
    const font = resetParamsForSection(params, 'font');

    expect(style.styleId).toBe(DEFAULT_PARAMS.styleId);
    expect(style.fontId).toBe(params.fontId);
    expect(font.fontId).toBe(DEFAULT_PARAMS.fontId);
    expect(font.styleId).toBe(params.styleId);
  });

  it('normalizes shape defaults for articulated names', () => {
    const result = resetParamsForSection(
      { ...changedParams(), templateId: 'articulated-name' },
      'shape',
    );

    expect(result.textSizeMm).toBe(DEFAULT_PARAMS.textSizeMm);
    expect(result.stakeLengthMm).toBe(DEFAULT_PARAMS.stakeLengthMm);
    expect(result.plantAccentEnabled).toBe(DEFAULT_PARAMS.plantAccentEnabled);
    expect(result.baseThicknessMm).toBe(3.4);
    expect(result.templateId).toBe('articulated-name');
    expect(result.fontId).toBe('caveat');
  });
});

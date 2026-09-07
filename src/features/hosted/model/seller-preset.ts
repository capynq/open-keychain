import { FONT_CATALOG } from '@/entities/keychain/fonts/catalog';
import {
  DEFAULT_PARAMS,
  normalizeParams,
  type KeychainParams,
} from '@/entities/keychain/model/types';

export const DEFAULT_PRESET_PRINT_PROFILE_ID = 'fdm-standard-0.4';

// Keep artwork out of seller presets even while older model contracts lack the field.
export type SellerPresetParams = Omit<KeychainParams, 'text' | 'subtitle'> & {
  modelFeatures?: never;
};

const bundledFontId = (fontId: string): string =>
  FONT_CATALOG.some((font) => font.id === fontId) ? fontId : FONT_CATALOG[0].id;

/** Removes customer-specific content before a preset ever reaches the hosted API. */
export const presetParamsForStorage = (params: KeychainParams): SellerPresetParams => {
  const normalized = normalizeParams(params);
  const preset = { ...normalized };

  Reflect.deleteProperty(preset, 'text');
  Reflect.deleteProperty(preset, 'subtitle');
  Reflect.deleteProperty(preset, 'modelFeatures');

  return {
    ...preset,
    fontId: bundledFontId(preset.fontId),
    subtitleFontId: bundledFontId(preset.subtitleFontId),
    templateId: 'name-keychain',
  } as SellerPresetParams;
};

/** Rehydrates a local customer order. Customer text is intentionally never read from the API. */
export const paramsForPresetOrder = (
  preset: SellerPresetParams,
  text: string,
  subtitle = '',
): KeychainParams =>
  normalizeParams({
    ...DEFAULT_PARAMS,
    ...preset,
    templateId: 'name-keychain',
    text,
    subtitle,
  });

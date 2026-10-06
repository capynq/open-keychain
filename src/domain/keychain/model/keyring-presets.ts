import type { KeychainParams } from './types';

export type KeyringPresetId =
  'compact-round' | 'standard-round' | 'large-round' | 'oval-slot' | 'custom';
export type KeyringOpeningShape = 'round' | 'slot';

export type KeyringPreset = {
  id: Exclude<KeyringPresetId, 'custom'>;
  shape: KeyringOpeningShape;
  widthMm: number;
  lengthMm: number;
};

/** Dimensions describe the clear opening, not a guaranteed fit to specific hardware. */
export const KEYRING_PRESETS: readonly KeyringPreset[] = [
  { id: 'compact-round', shape: 'round', widthMm: 3.5, lengthMm: 3.5 },
  { id: 'standard-round', shape: 'round', widthMm: 5, lengthMm: 5 },
  { id: 'large-round', shape: 'round', widthMm: 7, lengthMm: 7 },
  { id: 'oval-slot', shape: 'slot', widthMm: 4, lengthMm: 8 },
];

export const keyringPresetNameKey = (id: KeyringPresetId): string =>
  ({
    'compact-round': 'keyringPresetCompactRound',
    'standard-round': 'keyringPresetStandardRound',
    'large-round': 'keyringPresetLargeRound',
    'oval-slot': 'keyringPresetOvalSlot',
    custom: 'keyringPresetCustom',
  })[id];

export const keyringPresetValues = (
  id: Exclude<KeyringPresetId, 'custom'>,
): Pick<
  KeychainParams,
  'keyringPreset' | 'keyringOpeningShape' | 'holeDiameterMm' | 'keyringSlotLengthMm'
> => {
  const preset = KEYRING_PRESETS.find((item) => item.id === id);
  if (!preset) throw new Error(`Unknown keyring preset: ${id}`);
  return {
    keyringPreset: preset.id,
    keyringOpeningShape: preset.shape,
    holeDiameterMm: preset.widthMm,
    keyringSlotLengthMm: preset.lengthMm,
  };
};

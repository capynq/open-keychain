import { describe, expect, it } from 'vitest';

import { DEFAULT_PARAMS } from '@/entities/keychain/model/types';

import { paramsForPresetOrder, presetParamsForStorage } from './seller-preset';

describe('seller preset privacy boundary', () => {
  it('removes customer text and normalizes unsupported fonts before storage', () => {
    const preset = presetParamsForStorage({
      ...DEFAULT_PARAMS,
      fontId: 'local-private-font',
      subtitle: 'Birthday',
      text: 'ALEX',
    });

    expect(preset).not.toHaveProperty('text');
    expect(preset).not.toHaveProperty('subtitle');
    expect(preset.fontId).toBe('nunito');
    expect(preset.templateId).toBe('name-keychain');
  });

  it('rehydrates customer text only for local batch generation', () => {
    const preset = presetParamsForStorage(DEFAULT_PARAMS);
    const params = paramsForPresetOrder(preset, 'MIRA');

    expect(params).toMatchObject({ templateId: 'name-keychain', text: 'MIRA', subtitle: '' });
  });
});

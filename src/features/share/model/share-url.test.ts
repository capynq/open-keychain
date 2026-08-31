import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, decodeDesignDocument, normalizeParams } from '../../../entities/keychain';
import { buildShareUrl } from './share-url';

describe('buildShareUrl', () => {
  it('preserves the current route and creates a v5 design payload', () => {
    const appearanceOverrides = { version: 1 as const, base: '#B84838' as const };
    const value = buildShareUrl(
      'https://open-keychain.com/create?template=magnet',
      DEFAULT_PARAMS,
      appearanceOverrides,
    );
    const shared = decodeDesignDocument(new URL(value).searchParams.get('design') ?? '');

    expect(new URL(value).pathname).toBe('/create');
    expect(shared?.params).toEqual(normalizeParams(DEFAULT_PARAMS));
    expect(shared?.appearanceOverrides).toEqual(appearanceOverrides);
  });
});

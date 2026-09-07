import { describe, expect, it } from 'vitest';

import { designParams } from '@/domain/keychain/model/design-schema';

import { decodeDesignDocument } from '../../../domain/keychain/design-document';
import { DEFAULT_PARAMS, normalizeParams } from '../../../domain/keychain/model/types';
import { buildShareUrl } from './share-url';

describe('buildShareUrl', () => {
  it('preserves the current route and creates a v6 design payload', () => {
    const appearanceOverrides = { version: 1 as const, base: '#B84838' as const };
    const value = buildShareUrl(
      'https://open-keychain.com/create?template=magnet',
      DEFAULT_PARAMS,
      appearanceOverrides,
    );
    const shared = decodeDesignDocument(new URL(value).searchParams.get('design') ?? '');

    expect(new URL(value).pathname).toBe('/create');
    expect(shared && designParams(shared)).toEqual(normalizeParams(DEFAULT_PARAMS));
    expect(shared?.appearanceOverrides).toEqual(appearanceOverrides);
  });
});

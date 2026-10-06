import { describe, expect, it } from 'vitest';

import {
  ARTICULATED_PRINT_APPEARANCE,
  DEFAULT_PRINT_APPEARANCE,
} from '@/domain/keychain/model/types';

import { setupAppearance, setupEditorPath } from './quick-setup';

describe('setup appearance', () => {
  it('resolves template defaults before geometry is ready', () => {
    expect(setupAppearance('name-keychain', { version: 1 }).base).toBe(
      DEFAULT_PRINT_APPEARANCE.base.color,
    );
    expect(setupAppearance('articulated-name', { version: 1 }).base).toBe(
      ARTICULATED_PRINT_APPEARANCE.base.color,
    );
  });
  it('uses accepted overrides with normalized hex colors', () => {
    expect(
      setupAppearance(
        'name-keychain',
        { version: 1, base: '#123abc' },
        ARTICULATED_PRINT_APPEARANCE,
      ),
    ).toEqual({ version: 1, base: '#123ABC', relief: ARTICULATED_PRINT_APPEARANCE.relief.color });
  });
});

describe('setup editor route', () => {
  it('preserves shared and template inputs when closing setup', () => {
    const query = new URLSearchParams(
      setupEditorPath('?setup=1&design=abc&template=magnet', 'uk').split('?')[1],
    );
    expect(query.has('setup')).toBe(false);
    expect(query.get('design')).toBe('abc');
    expect(query.get('template')).toBe('magnet');
    expect(query.get('lang')).toBe('uk');
  });
});

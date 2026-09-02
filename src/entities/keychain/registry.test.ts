import { describe, expect, it } from 'vitest';

import { STYLE_CATALOG } from '../../domain/keychain/styles/style-builder';
import { TEMPLATE_CATALOG } from '../../domain/keychain/templates/template-builder';
import { STYLE_BUILDERS } from './styles/registry';
import { TEMPLATE_BUILDERS } from './templates/registry';

describe('keychain entity registries', () => {
  it('exposes one builder for every catalog style', () => {
    expect(Object.keys(STYLE_BUILDERS).sort()).toEqual(
      STYLE_CATALOG.map((style) => style.id).sort(),
    );
  });

  it('exposes one builder for every catalog template', () => {
    expect(Object.keys(TEMPLATE_BUILDERS).sort()).toEqual(
      TEMPLATE_CATALOG.map((template) => template.id).sort(),
    );
  });
});

import { describe, expect, it } from 'vitest';

import { STYLE_BUILDERS, STYLE_CATALOG, TEMPLATE_BUILDERS, TEMPLATE_CATALOG } from './index';

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

import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, encodeDesignDocument } from '../../../entities/keychain';
import { parseCustomizerRoute } from './parseCustomizerRoute';

describe('parseCustomizerRoute', () => {
  it('normalizes a template query into initial parameters', () => {
    const route = parseCustomizerRoute('?template=magnet', null);

    expect(route.initialParams?.templateId).toBe('magnet');
    expect(route.hasInvalidDesign).toBe(false);
  });

  it('prefers a shared v5 document over template and project state', () => {
    const design = encodeDesignDocument({ version: 5, params: DEFAULT_PARAMS });
    const route = parseCustomizerRoute(`?template=magnet&design=${design}`, {
      projectParams: { templateId: 'plant-label' },
    });

    expect(route.initialParams?.templateId).toBe(DEFAULT_PARAMS.templateId);
    expect(route.routeInputKey).toBe(design);
  });

  it('marks malformed design values without blocking the route', () => {
    const route = parseCustomizerRoute('?design=invalid', null);

    expect(route.hasInvalidDesign).toBe(true);
    expect(route.initialParams).toBeUndefined();
  });
});

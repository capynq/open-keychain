import { describe, expect, it } from 'vitest';

import { createDesignDocument } from '@/domain/keychain/model/design-schema';
import { encodeDesignDocument } from '@/entities/keychain/design-document';
import { fontDefinition, fontSupportsArticulatedName } from '@/entities/keychain/fonts/catalog';
import { DEFAULT_PARAMS } from '@/entities/keychain/model/types';

import { parseCustomizerRoute } from './parseCustomizerRoute';

describe('parseCustomizerRoute', () => {
  it('normalizes a template query into initial parameters', () => {
    const route = parseCustomizerRoute('?template=magnet', null);

    expect(route.initialParams?.templateId).toBe('magnet');
    expect(route.hasInvalidDesign).toBe(false);
  });

  it('chooses an articulated-compatible font for a template query', () => {
    const route = parseCustomizerRoute('?template=articulated-name', null);

    expect(route.initialParams?.templateId).toBe('articulated-name');
    expect(
      fontSupportsArticulatedName(
        fontDefinition(route.initialParams?.fontId ?? ''),
        route.initialParams?.text ?? '',
      ),
    ).toBe(true);
  });

  it('prefers a shared v9 document over template and project state', () => {
    const design = encodeDesignDocument(createDesignDocument(DEFAULT_PARAMS));
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
  it('restores legacy backing independently of the text finish', () => {
    const payload = Buffer.from(
      JSON.stringify({ finish: { ef: 'round', et: 0.6, es: 'chamfer', er: 0.2 } }),
    ).toString('base64url');
    const route = parseCustomizerRoute(`?design=v7.${payload}`, null);
    expect(route.initialParams?.textEdgeFinish).toBe('chamfer');
    expect(route.initialParams?.edgeFinish).toBe('round');
    expect(route.initialParams?.topEdgeMm).toBeCloseTo(0.6);
    expect(
      parseCustomizerRoute('', {
        projectParams: { ...DEFAULT_PARAMS, edgeFinish: 'round', topEdgeMm: 0.2 },
      }).initialParams?.edgeFinish,
    ).toBe('round');
  });
});

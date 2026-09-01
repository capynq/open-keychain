import { describe, expect, it } from 'vitest';

import { DEFAULT_PARAMS } from '../../../domain/keychain';
import { randomizeParams, randomizeWithValidation } from './randomizer';

describe('randomizeParams', () => {
  it('uses an injectable bounded source and keeps the design valid', () => {
    const values = [0, 0.999999, 0.25, 0.75];
    let index = 0;
    const result = randomizeParams(
      { ...DEFAULT_PARAMS, text: 'Mila' },
      { random: () => values[index++ % values.length] },
    );

    expect(result.text).toBe('Mila');
    expect(result.templateId).toBe('articulated-name');
    expect(result.textSizeMm).toBeGreaterThanOrEqual(12);
    expect(result.textSizeMm).toBeLessThanOrEqual(30);
    expect(result.baseThicknessMm).toBeGreaterThanOrEqual(3.4);
  });

  it('does not randomize shape controls when requested', () => {
    const result = randomizeParams(DEFAULT_PARAMS, {
      random: () => 0,
      templates: ['plant-label'],
      randomizeShape: false,
    });

    expect(result.templateId).toBe('plant-label');
    expect(result.textSizeMm).toBe(DEFAULT_PARAMS.textSizeMm);
    expect(result.paddingMm).toBe(DEFAULT_PARAMS.paddingMm);
  });

  it('clamps out-of-range random values rather than producing invalid indices', () => {
    const result = randomizeParams(DEFAULT_PARAMS, {
      random: () => 42,
      randomizeShape: false,
    });

    expect(result.templateId).toBe('plant-label');
    expect(result.fontId).toBeTruthy();
  });

  it('returns an atomic accepted transaction with bounded attempts', async () => {
    const result = await randomizeWithValidation(
      DEFAULT_PARAMS,
      async () => ({ printable: true }),
      { random: () => 0, attempts: 3 },
    );

    expect(result.status).toBe('accepted');
    expect(result.attempts).toBe(1);
    expect(result.params.text).toBe(DEFAULT_PARAMS.text);
  });

  it('returns the original design after validation exhaustion', async () => {
    const result = await randomizeWithValidation(DEFAULT_PARAMS, async () => false, {
      attempts: 2,
    });

    expect(result).toMatchObject({ status: 'exhausted', params: DEFAULT_PARAMS, attempts: 2 });
  });
});

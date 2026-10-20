import { globSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { RECOVERY_CATALOG, recoveryDefinition } from './catalog';
import { RecoveryError, failureFrom } from './failure';

describe('recovery failures', () => {
  it('keeps structured failures and measured context through Error serialization', () => {
    const failure = {
      code: 'text-edge-too-large',
      message: 'finish rejected',
      context: {
        target: 'text' as const,
        profile: 'round' as const,
        maximumMm: 0.2,
        requestedMm: 0.4,
      },
    };
    const restored = failureFrom(new RecoveryError(failure));
    expect(restored).toEqual(failure);
    expect(JSON.parse(JSON.stringify(restored))).toEqual(failure);
  });

  it('drops malformed context fields while preserving finite measurements', () => {
    const restored = failureFrom({
      code: 'text-edge-too-large',
      message: 'rejected',
      context: {
        target: 'side',
        profile: { value: 'round' },
        maximumMm: Number.NaN,
        requestedMm: 0.4,
        nested: { secret: 'value' },
      },
    });
    expect(restored).toEqual({
      code: 'text-edge-too-large',
      message: 'rejected',
      context: { requestedMm: 0.4 },
    });
  });

  it('provides a definition for every known issue and a stable unknown fallback', () => {
    expect(Object.keys(RECOVERY_CATALOG).length).toBeGreaterThan(35);
    expect(recoveryDefinition('missing-glyph').strategy).toBe('font');
    expect(recoveryDefinition('does-not-exist').strategy).toBe('unknown');
    expect(Object.values(RECOVERY_CATALOG).every((definition) => definition.stepsKey)).toBe(true);
  });

  it('covers literal producer codes outside tests and the catalog itself', () => {
    const producerCodes = new Set<string>();
    let scannedFiles = 0;

    for (const file of globSync('src/**/*.{ts,tsx}')) {
      if (file.includes('.test.') || file.endsWith('/recovery/catalog.ts')) continue;

      scannedFiles += 1;

      const source = readFileSync(file, 'utf8');

      for (const match of source.matchAll(/\bcode:\s*['"]([^'"]+)['"]/g))
        producerCodes.add(match[1]);

      for (const match of source.matchAll(/failureFrom\([^,]+,\s*['"]([^'"]+)['"]\s*\)/g))
        producerCodes.add(match[1]);
    }

    expect(scannedFiles).toBeGreaterThan(100);
    expect(producerCodes.size).toBeGreaterThan(30);
    const internalOnly = new Set<string>();

    for (const code of producerCodes) {
      if (internalOnly.has(code)) continue;

      expect(RECOVERY_CATALOG[code], `missing catalog entry for ${code}`).toBeDefined();
    }
  });

  it('has localized message and steps keys in every supported locale', () => {
    for (const locale of ['en', 'ru', 'uk']) {
      const messages = JSON.parse(
        readFileSync(`src/infrastructure/i18n/locales/${locale}.json`, 'utf8'),
      ) as Record<string, unknown>;

      const resolve = (key: string): unknown =>
        key
          .split('.')
          .reduce<unknown>(
            (value, part) =>
              value && typeof value === 'object'
                ? (value as Record<string, unknown>)[part]
                : undefined,
            messages,
          );

      for (const definition of Object.values(RECOVERY_CATALOG)) {
        expect(typeof resolve(definition.messageKey), `${locale}: ${definition.messageKey}`).toBe(
          'string',
        );
        expect(typeof resolve(definition.stepsKey!), `${locale}: ${definition.stepsKey}`).toBe(
          'string',
        );
        expect(resolve(definition.messageKey)).not.toBe(definition.messageKey);
        expect(resolve(definition.stepsKey!)).not.toBe(definition.stepsKey);
      }
    }
  });
});

import { describe, expect, it } from 'vitest';

import { FONT_CATALOG } from '../fonts/catalog';
import { type StyleId } from '../model/types';
import { buildKeychain } from './keychain-builder';
import { DEFAULT_PARAMS, topSurfaceArea, wasm } from './keychain-builder-test-helpers';

/**
 * Registers the per-style font coverage of the "styles and fonts" suite.
 *
 * Vitest parallelises across files but runs the tests inside a file serially, so
 * these style x font cases live in one file per style
 * (`keychain-builder.styles-fonts.<style>.test.ts`) instead of a single file that
 * used to be the whole critical path of the unit gate. Test names are unchanged.
 */
export const describeStyleFontCases = (styleId: StyleId) =>
  describe('styles and fonts', () => {
    it(`changes ${styleId} geometry across the full backing-size range`, async () => {
      const compact = await buildKeychain(wasm, {
        ...DEFAULT_PARAMS,
        styleId,
        text: 'ALEX',
        paddingMm: 1.2,
        edgeInsetMm: 1.2,
      });
      const spacious = await buildKeychain(wasm, {
        ...DEFAULT_PARAMS,
        styleId,
        text: 'ALEX',
        paddingMm: 4,
        edgeInsetMm: 4,
      });
      expect(compact.result.printable, JSON.stringify(compact.result.issues)).toBe(true);
      expect(spacious.result.printable, JSON.stringify(spacious.result.issues)).toBe(true);
      expect(topSurfaceArea(spacious.result.baseMesh).surface).toBeGreaterThan(
        topSurfaceArea(compact.result.baseMesh).surface,
      );
    }, 30000);

    for (const font of FONT_CATALOG) {
      it(`contains Latin relief for ${font.name} ${styleId}`, async () => {
        const { result } = await buildKeychain(wasm, {
          ...DEFAULT_PARAMS,
          fontId: font.id,
          styleId,
          text: 'ALEX',
        });
        expect(result.printable, JSON.stringify(result.issues)).toBe(true);
        expect(result.issues.some((issue) => issue.code === 'relief-outside-backing')).toBe(false);
        expect(result.dimensions.widthMm).toBeLessThanOrEqual(120.1);
      }, 30000);
    }

    for (const font of FONT_CATALOG.filter((font) => font.scripts.includes('cyrillic'))) {
      it(`contains Cyrillic relief for ${font.name} ${styleId}`, async () => {
        const { result } = await buildKeychain(wasm, {
          ...DEFAULT_PARAMS,
          fontId: font.id,
          styleId,
          text: 'НИКИТА',
        });
        expect(result.printable, JSON.stringify(result.issues)).toBe(true);
        expect(result.issues.some((issue) => issue.code === 'relief-outside-backing')).toBe(false);
      }, 30000);
    }
  });

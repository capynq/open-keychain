import { useCallback } from 'react';

import type { FontDefinition } from '@/domain/keychain/fonts/catalog';
import type { RecoveryFailure } from '@/shared/lib/recovery/failure';

import { failureFrom } from '@/shared/lib/recovery/failure';

const loadingFonts = new Map<string, Promise<FontPreviewLoadResult>>();
const loadingBooleanFonts = new Map<string, Promise<boolean>>();
const loadedFonts = new Set<string>();

const fontIdentity = (font: FontDefinition): string => `${font.id}:${font.dataRevision ?? ''}`;

export type FontPreviewLoadResult = { ok: true } | { ok: false; failure: RecoveryFailure };

const loadPreviewFontResult = (font: FontDefinition): Promise<FontPreviewLoadResult> => {
  if (
    font.source === 'bundled' ||
    loadedFonts.has(fontIdentity(font)) ||
    typeof FontFace === 'undefined' ||
    typeof document === 'undefined'
  ) {
    return Promise.resolve({ ok: true });
  }

  const identity = fontIdentity(font);
  const existing = loadingFonts.get(identity);
  if (existing) return existing;

  const load: Promise<FontPreviewLoadResult> = (async () => {
    let objectUrl: string | undefined;
    try {
      if (font.source === 'local' && font.data) {
        objectUrl = URL.createObjectURL(new Blob([font.data], { type: 'font/ttf' }));
      }
      const face = new FontFace(font.previewFamily, `url(${objectUrl ?? font.file})`, {
        weight: String(font.weight),
      });

      await face.load();
      document.fonts.add(face);
      loadedFonts.add(identity);
      return { ok: true };
    } catch (error) {
      return { ok: false, failure: failureFrom(error, 'font-load') };
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  })();

  loadingFonts.set(identity, load);

  const clear = (): void => {
    if (loadingFonts.get(identity) === load) loadingFonts.delete(identity);
  };

  void load.finally(clear).catch(() => undefined);
  return load;
};

export const loadPreviewFont = (font: FontDefinition): Promise<boolean> => {
  const identity = fontIdentity(font);
  const existing = loadingBooleanFonts.get(identity);
  if (existing) return existing;
  const load = loadPreviewFontResult(font).then((result) => result.ok);

  loadingBooleanFonts.set(identity, load);
  void load
    .finally(() => {
      if (loadingBooleanFonts.get(identity) === load) loadingBooleanFonts.delete(identity);
    })
    .catch(() => undefined);
  return load;
};

export const loadPreviewFontWithFailure = (font: FontDefinition): Promise<FontPreviewLoadResult> =>
  loadPreviewFontResult(font);

export const useFontPreviewLoader = () => ({
  loadFont: useCallback((font: FontDefinition): Promise<boolean> => loadPreviewFont(font), []),
  loadFontWithFailure: useCallback(
    (font: FontDefinition): Promise<FontPreviewLoadResult> => loadPreviewFontWithFailure(font),
    [],
  ),
});

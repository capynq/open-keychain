import { useCallback } from 'react';

import type { FontDefinition } from '@/domain/keychain/fonts/catalog';

const loadingFonts = new Map<string, Promise<boolean>>();
const loadedFonts = new Set<string>();

const fontIdentity = (font: FontDefinition): string => `${font.id}:${font.dataRevision ?? ''}`;

export const loadPreviewFont = (font: FontDefinition): Promise<boolean> => {
  if (
    font.source === 'bundled' ||
    loadedFonts.has(fontIdentity(font)) ||
    typeof FontFace === 'undefined' ||
    typeof document === 'undefined'
  ) {
    return Promise.resolve(true);
  }

  const identity = fontIdentity(font);
  const existing = loadingFonts.get(identity);
  if (existing) return existing;

  const load = (async () => {
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
      return true;
    } catch {
      return false;
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

export const useFontPreviewLoader = () => ({
  loadFont: useCallback((font: FontDefinition): Promise<boolean> => loadPreviewFont(font), []),
});

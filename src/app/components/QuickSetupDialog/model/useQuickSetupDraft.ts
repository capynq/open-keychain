import { useEffect, useRef, useState } from 'react';

import type { FontCategory } from '@/domain/keychain/fonts/catalog';
import type { KeyringPosition } from '@/domain/keychain/model/keyring-position';
import type { KeyringOpeningShape, KeyringPresetId } from '@/domain/keychain/model/keyring-presets';
import type { PrintAppearanceOverrides, SizeEnvelope } from '@/domain/keychain/model/types';

export const SIZE_PRESETS: readonly SizeEnvelope[] = [
  { widthMm: 40, heightMm: 20 },
  { widthMm: 60, heightMm: 25 },
  { widthMm: 80, heightMm: 30 },
  { widthMm: 100, heightMm: 35 },
  { widthMm: 120, heightMm: 40 },
];
export type QuickSetupStepId =
  'name-size' | 'keyring-position' | 'keyring-opening' | 'fonts' | 'colors' | 'review';

export type QuickSetupDraft = {
  text: string;
  sizeChoice: string;
  customWidth: string;
  customHeight: string;
  keyringPreset: KeyringPresetId;
  keyringPosition: KeyringPosition;
  keyringOpeningShape: KeyringOpeningShape;
  keyringWidthMm: number;
  keyringLengthMm: number;
  favoriteCategories: FontCategory[];
  appearanceOverrides: PrintAppearanceOverrides;
};

const sizeKey = (size: SizeEnvelope): string => `${size.widthMm}x${size.heightMm}`;

const createDraft = ({
  initialText,
  initialSize,
  initialFavoriteCategories,
  initialAppearanceOverrides,
  initialKeyringPreset,
  initialKeyringPosition,
  initialKeyringOpeningShape,
  initialKeyringWidthMm,
  initialKeyringLengthMm,
}: {
  initialText: string;
  initialSize?: SizeEnvelope;
  initialFavoriteCategories: FontCategory[];
  initialAppearanceOverrides: PrintAppearanceOverrides;
  initialKeyringPreset: KeyringPresetId;
  initialKeyringPosition: KeyringPosition;
  initialKeyringOpeningShape: KeyringOpeningShape;
  initialKeyringWidthMm: number;
  initialKeyringLengthMm: number;
}): QuickSetupDraft => {
  const preset = initialSize && SIZE_PRESETS.find((size) => sizeKey(size) === sizeKey(initialSize));

  return {
    text: initialText,
    sizeChoice: initialSize ? (preset ? sizeKey(preset) : 'custom') : '',
    customWidth: initialSize ? String(initialSize.widthMm) : '',
    customHeight: initialSize ? String(initialSize.heightMm) : '',
    keyringPreset: initialKeyringPreset,
    keyringPosition: initialKeyringPosition,
    keyringOpeningShape: initialKeyringOpeningShape,
    keyringWidthMm: initialKeyringWidthMm,
    keyringLengthMm: initialKeyringLengthMm,
    favoriteCategories: [...initialFavoriteCategories],
    appearanceOverrides: { ...initialAppearanceOverrides },
  };
};

export const getDraftSize = (draft: QuickSetupDraft): SizeEnvelope | undefined => {
  if (draft.sizeChoice !== 'custom') {
    return SIZE_PRESETS.find((size) => sizeKey(size) === draft.sizeChoice);
  }

  const widthMm = Number(draft.customWidth);
  const heightMm = Number(draft.customHeight);
  if (
    !Number.isFinite(widthMm) ||
    !Number.isFinite(heightMm) ||
    widthMm < 20 ||
    widthMm > 120 ||
    heightMm < 15 ||
    heightMm > 80
  ) {
    return undefined;
  }

  return { widthMm, heightMm };
};

export const useQuickSetupDraft = ({
  open,
  initialText,
  initialSize,
  initialFavoriteCategories,
  initialAppearanceOverrides,
  initialKeyringPreset,
  initialKeyringPosition,
  initialKeyringOpeningShape,
  initialKeyringWidthMm,
  initialKeyringLengthMm,
}: {
  open: boolean;
  initialText: string;
  initialSize?: SizeEnvelope;
  initialFavoriteCategories: FontCategory[];
  initialAppearanceOverrides: PrintAppearanceOverrides;
  initialKeyringPreset: KeyringPresetId;
  initialKeyringPosition: KeyringPosition;
  initialKeyringOpeningShape: KeyringOpeningShape;
  initialKeyringWidthMm: number;
  initialKeyringLengthMm: number;
}) => {
  const [draft, setDraft] = useState(() =>
    createDraft({
      initialText,
      initialSize,
      initialFavoriteCategories,
      initialAppearanceOverrides,
      initialKeyringPreset,
      initialKeyringPosition,
      initialKeyringOpeningShape,
      initialKeyringWidthMm,
      initialKeyringLengthMm,
    }),
  );
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      return;
    }
    if (wasOpen.current) return;
    wasOpen.current = true;
    // Initialize the draft only at a new dialog session.

    setDraft(
      createDraft({
        initialText,
        initialSize,
        initialFavoriteCategories,
        initialAppearanceOverrides,
        initialKeyringPreset,
        initialKeyringPosition,
        initialKeyringOpeningShape,
        initialKeyringWidthMm,
        initialKeyringLengthMm,
      }),
    );
  }, [
    initialAppearanceOverrides,
    initialFavoriteCategories,
    initialKeyringPreset,
    initialKeyringPosition,
    initialKeyringOpeningShape,
    initialKeyringWidthMm,
    initialKeyringLengthMm,
    initialSize,
    initialText,
    open,
  ]);

  return [draft, setDraft] as const;
};

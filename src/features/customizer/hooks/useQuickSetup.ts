import type { NavigateFunction } from 'react-router';

import { useCallback, useEffect, useState } from 'react';

import type { Locale } from '@/infrastructure/i18n/config';

import {
  FONT_CATEGORY_ORDER,
  articulatedFallbackFont,
  fontSupportsArticulatedName,
  type FontCategory,
} from '@/domain/keychain/fonts/catalog';
import { keyringPresetValues } from '@/domain/keychain/model/keyring-presets';
import { normalizeParams, type PrintAppearanceOverrides } from '@/domain/keychain/model/types';

import type { useCustomizerParams } from './useCustomizerParams';

import { setupEditorPath, type QuickSetupChanges } from '../model/quick-setup';

const FAVORITES_STORAGE_KEY = 'open-keychain.favorite-font-categories';

export const useQuickSetup = ({
  search,
  locationState,
  locale,
  navigate,
  customizer,
  onAppearanceChange,
}: {
  search: string;
  locationState: unknown;
  locale: Locale;
  navigate: NavigateFunction;
  customizer: ReturnType<typeof useCustomizerParams>;
  onAppearanceChange: (appearance: PrintAppearanceOverrides) => void;
}) => {
  const searchParams = new URLSearchParams(search);
  const setupRequested = searchParams.get('setup') === '1';
  const setupAllowed = setupRequested && !searchParams.has('design') && !locationState;
  const [setupOpen, setSetupOpen] = useState(setupAllowed);
  const [pendingSetup, setPendingSetup] = useState<{
    changes: QuickSetupChanges;
    signature: string;
  }>();
  const setupSubmitting = Boolean(pendingSetup);
  const [setupError, setSetupError] = useState(false);
  const [favoriteFontCategories, setFavoriteFontCategories] = useState<FontCategory[]>(() => {
    try {
      if (typeof localStorage === 'undefined') return [];
      const stored = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) ?? '[]');

      return Array.isArray(stored)
        ? stored.filter((item): item is FontCategory => FONT_CATEGORY_ORDER.includes(item))
        : [];
    } catch {
      return [];
    }
  });

  const commitPreferences = useCallback(
    (changes: QuickSetupChanges) => {
      setFavoriteFontCategories(changes.favoriteFontCategories);
      onAppearanceChange(changes.appearanceOverrides);
      try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(changes.favoriteFontCategories));
      } catch {
        // Keep the preference for this session when storage is unavailable.
      }
    },
    [onAppearanceChange],
  );

  useEffect(() => {
    if (!pendingSetup) return;
    if (customizer.candidateFeedback?.status === 'checking') return;

    // Commit non-geometric choices only after the candidate is accepted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingSetup(undefined);
    if (
      customizer.candidateFeedback?.status === 'rejected' ||
      JSON.stringify(normalizeParams(customizer.acceptedParams)) !== pendingSetup.signature
    ) {
      setSetupError(true);
      return;
    }

    commitPreferences(pendingSetup.changes);
    setSetupOpen(false);
    if (setupRequested)
      navigate(setupEditorPath(search, locale), { replace: true, state: locationState });
  }, [
    customizer.acceptedParams,
    customizer.candidateFeedback,
    commitPreferences,
    locale,
    navigate,
    onAppearanceChange,
    pendingSetup,
    setupRequested,
    search,
    locationState,
  ]);

  const openSetup = (): void => {
    setSetupError(false);
    setSetupOpen(true);
  };
  const closeSetup = (): void => {
    if (setupSubmitting) return;
    setSetupOpen(false);
    if (setupRequested)
      navigate(setupEditorPath(search, locale), { replace: true, state: locationState });
  };
  const applySetup = (changes: QuickSetupChanges): void => {
    if (setupSubmitting || customizer.candidateFeedback?.status === 'checking') return;
    const params = {
      text: changes.text,
      sizeEnvelope: changes.sizeEnvelope,
      ...(changes.keyringPosition ? { keyringPosition: changes.keyringPosition } : {}),
      ...(changes.keyringPreset ? keyringPresetValues(changes.keyringPreset) : {}),
    };
    const compatibleParams =
      customizer.acceptedParams.templateId === 'articulated-name' &&
      !fontSupportsArticulatedName(customizer.selectedFont, changes.text)
        ? { ...params, fontId: articulatedFallbackFont(changes.text).id }
        : params;

    const candidateParams = normalizeParams({ ...customizer.acceptedParams, ...compatibleParams });
    if (
      JSON.stringify(candidateParams) === JSON.stringify(normalizeParams(customizer.acceptedParams))
    ) {
      commitPreferences(changes);
      setSetupOpen(false);
      if (setupRequested)
        navigate(setupEditorPath(search, locale), { replace: true, state: locationState });
      return;
    }

    customizer.clearCandidateFeedback();
    setSetupError(false);
    setPendingSetup({
      changes,
      signature: JSON.stringify(candidateParams),
    });
    customizer.updateMany(compatibleParams, 'template');
  };

  return {
    setupOpen,
    setupSubmitting,
    setupError,
    favoriteFontCategories,
    openSetup,
    closeSetup,
    applySetup,
  };
};

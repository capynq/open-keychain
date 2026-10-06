import type { Dispatch, SetStateAction } from 'react';

import type { KeyringPresetId } from '@/domain/keychain/model/keyring-presets';
import type { Locale } from '@/infrastructure/i18n';

import { KEYRING_PRESETS } from '@/domain/keychain/model/keyring-presets';
import { KeyringPresetPicker } from '@/features/customizer/components/KeyringPresetPicker/KeyringPresetPicker';

import type { QuickSetupDraft } from './model/useQuickSetupDraft';

export const KeyringStep = ({
  locale,
  draft,
  setDraft,
}: {
  locale: Locale;
  draft: QuickSetupDraft;
  setDraft: Dispatch<SetStateAction<QuickSetupDraft>>;
}) => {
  const select = (keyringPreset: KeyringPresetId) => {
    const preset = KEYRING_PRESETS.find((item) => item.id === keyringPreset);

    setDraft((current) => ({
      ...current,
      keyringPreset,
      ...(preset
        ? {
            keyringOpeningShape: preset.shape,
            keyringWidthMm: preset.widthMm,
            keyringLengthMm: preset.lengthMm,
          }
        : {}),
    }));
  };

  return (
    <div className="keyring-setup-step">
      <KeyringPresetPicker
        locale={locale}
        selected={draft.keyringPreset}
        openingShape={draft.keyringOpeningShape}
        widthMm={draft.keyringWidthMm}
        lengthMm={draft.keyringLengthMm}
        variant="setup"
        onSelect={select}
      />
    </div>
  );
};

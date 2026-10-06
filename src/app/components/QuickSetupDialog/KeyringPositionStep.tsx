import type { Dispatch, SetStateAction } from 'react';

import type { KeyringPosition } from '@/domain/keychain/model/keyring-position';
import type { Locale } from '@/infrastructure/i18n';

import { KeyringPositionPicker } from '@/features/customizer/components/KeyringPositionPicker/KeyringPositionPicker';

import type { QuickSetupDraft } from './model/useQuickSetupDraft';

export const KeyringPositionStep = ({
  locale,
  draft,
  setDraft,
}: {
  locale: Locale;
  draft: QuickSetupDraft;
  setDraft: Dispatch<SetStateAction<QuickSetupDraft>>;
}) => (
  <div className="keyring-setup-step">
    <KeyringPositionPicker
      locale={locale}
      selected={draft.keyringPosition}
      variant="setup"
      onSelect={(keyringPosition: KeyringPosition) =>
        setDraft((current) => ({ ...current, keyringPosition }))
      }
    />
  </div>
);

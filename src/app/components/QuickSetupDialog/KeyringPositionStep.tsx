import type { Dispatch, SetStateAction } from 'react';

import type { KeyringPosition } from '@/domain/keychain/model/keyring-position';
import type { KeychainParams } from '@/domain/keychain/model/types';
import type { Locale } from '@/infrastructure/i18n';

import { KeyringPositionPicker } from '@/features/customizer/components/KeyringPositionPicker/KeyringPositionPicker';

import type { QuickSetupDraft } from './model/useQuickSetupDraft';

export const KeyringPositionStep = ({
  locale,
  draft,
  setDraft,
  templateId,
  styleId,
}: {
  locale: Locale;
  draft: QuickSetupDraft;
  setDraft: Dispatch<SetStateAction<QuickSetupDraft>>;
  templateId?: KeychainParams['templateId'];
  styleId?: KeychainParams['styleId'];
}) => (
  <div className="keyring-setup-step">
    <KeyringPositionPicker
      locale={locale}
      selected={draft.keyringPosition}
      templateId={templateId}
      styleId={styleId}
      variant="setup"
      onSelect={(keyringPosition: KeyringPosition) =>
        setDraft((current) => ({ ...current, keyringPosition }))
      }
    />
  </div>
);

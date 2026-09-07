import { createDesignDocument } from '@/domain/keychain/model/design-schema';

import type {
  KeychainParams,
  PrintAppearanceOverrides,
} from '../../../domain/keychain/model/types';

import { encodeDesignDocument } from '../../../domain/keychain/design-document';

export const buildShareUrl = (
  locationHref: string,
  params: KeychainParams,
  appearanceOverrides: PrintAppearanceOverrides,
): string => {
  const url = new URL(locationHref);

  url.searchParams.set(
    'design',
    encodeDesignDocument(createDesignDocument(params, appearanceOverrides)),
  );

  return url.toString();
};

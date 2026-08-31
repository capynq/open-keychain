import { encodeDesignDocument } from '../../../entities/keychain';
import type { KeychainParams, PrintAppearanceOverrides } from '../../../entities/keychain';

export const buildShareUrl = (
  locationHref: string,
  params: KeychainParams,
  appearanceOverrides: PrintAppearanceOverrides,
): string => {
  const url = new URL(locationHref);

  url.searchParams.set('design', encodeDesignDocument({ version: 5, params, appearanceOverrides }));

  return url.toString();
};

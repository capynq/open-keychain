import type { KeychainParams } from '@/domain/keychain/model/types';

import type { PhotoFormat } from './photo-format';
import type { PhotoResolution } from './photo-resolution';

export type PhotoDesign = Pick<KeychainParams, 'text' | 'templateId' | 'styleId'>;

const slug = (value: string): string =>
  Array.from(
    value
      .normalize('NFC')
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, ''),
  )
    .slice(0, 48)
    .join('')
    .replace(/-+$/g, '');

export const photoFilename = (
  design: PhotoDesign | undefined,
  resolution: PhotoResolution,
  format: PhotoFormat,
): string => {
  if (!design) return `keychain-photo-${resolution}.${format}`;
  // These templates have no selectable backing style.
  const style =
    design.templateId === 'nameplate' || design.templateId === 'articulated-name'
      ? undefined
      : design.styleId;
  return (
    [slug(design.text) || 'name', design.templateId, style, `${resolution}px`]
      .filter(Boolean)
      .join('-') + `.${format}`
  );
};

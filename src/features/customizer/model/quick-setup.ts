import type { FontCategory } from '@/domain/keychain/fonts/catalog';
import type { KeyringPosition } from '@/domain/keychain/model/keyring-position';
import type { KeyringPresetId } from '@/domain/keychain/model/keyring-presets';
import type {
  PrintAppearance,
  PrintAppearanceOverrides,
  SizeEnvelope,
  TemplateId,
} from '@/domain/keychain/model/types';

import {
  applyPrintAppearanceOverrides,
  ARTICULATED_PRINT_APPEARANCE,
  DEFAULT_PRINT_APPEARANCE,
} from '@/domain/keychain/model/types';

export type QuickSetupChanges = {
  text: string;
  sizeEnvelope: SizeEnvelope;
  keyringPosition?: KeyringPosition;
  keyringPreset?: Exclude<KeyringPresetId, 'custom'>;
  favoriteFontCategories: FontCategory[];
  appearanceOverrides: PrintAppearanceOverrides;
};

export const setupAppearance = (
  templateId: TemplateId,
  overrides: PrintAppearanceOverrides,
  appearance?: PrintAppearance,
): PrintAppearanceOverrides => {
  const resolved = applyPrintAppearanceOverrides(
    appearance ??
      (templateId === 'articulated-name' ? ARTICULATED_PRINT_APPEARANCE : DEFAULT_PRINT_APPEARANCE),
    overrides,
  );
  return { version: 1, base: resolved.base.color, relief: resolved.relief.color };
};

/** Remove the setup request while preserving shared/template route inputs. */
export const setupEditorPath = (search: string, locale: string): string => {
  const query = new URLSearchParams(search);
  query.delete('setup');
  query.set('lang', locale);
  return `/create?${query.toString()}`;
};

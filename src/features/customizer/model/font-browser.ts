import type { FontCategory } from '@/domain/keychain/fonts/catalog';

export type FontSourceTab = 'bundled' | 'google' | 'local';
export type FontTarget = 'primary' | 'secondary';
export type FontBrowserState = {
  search: string;
  page: number;
  category: FontCategory | 'all';
  supportsTextOnly: boolean;
};

export const INITIAL_FONT_BROWSER_STATE: Record<FontSourceTab, FontBrowserState> = {
  bundled: { search: '', page: 1, category: 'all', supportsTextOnly: true },
  google: { search: '', page: 1, category: 'all', supportsTextOnly: true },
  local: { search: '', page: 1, category: 'all', supportsTextOnly: true },
};

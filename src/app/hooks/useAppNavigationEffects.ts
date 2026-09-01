import type { Location } from 'react-router';

import { useEffect } from 'react';

import { setLocale, type Locale } from '../../infrastructure/i18n';

/** Keeps browser scroll and the active i18n locale in sync with navigation. */
export const useAppNavigationEffects = (location: Location, locale: Locale): void => {
  useEffect(() => {
    if (location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.hash, location.pathname, location.search]);

  useEffect(() => {
    void setLocale(locale);
  }, [locale]);
};

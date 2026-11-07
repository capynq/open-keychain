import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  isLocaleLoaded,
  loadLocale,
  subscribeLocaleLoads,
  type Locale,
} from '../../infrastructure/i18n/config';

/**
 * The locale to render: the requested one once its strings have loaded, otherwise the last one
 * shown, so a language switch or a link to another locale never paints English in between.
 */
export const useLoadedLocale = (requested: Locale): Locale => {
  const loaded = useSyncExternalStore(
    subscribeLocaleLoads,
    () => isLocaleLoaded(requested),
    () => true,
  );
  const [shown, setShown] = useState(requested);
  if (loaded && shown !== requested) setShown(requested);

  useEffect(() => {
    if (!loaded) loadLocale(requested).catch(() => undefined);
  }, [loaded, requested]);

  return loaded ? requested : shown;
};

import { useEffect } from 'react';

import { CREATE_ROUTE } from '../routes';
import { preloadCreateRoute } from '../routing/routeModules';

const isCreateLink = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false;
  const anchor = target.closest<HTMLAnchorElement>('a[href]');

  if (!anchor) return false;

  const url = new URL(anchor.href, window.location.href);

  return url.origin === window.location.origin && url.pathname.replace(/\/+$/, '') === CREATE_ROUTE;
};

export const useRoutePreload = (): void => {
  useEffect(() => {
    const preloadOnIntent = (event: Event): void => {
      if (!isCreateLink(event.target)) return;
      void preloadCreateRoute().catch(() => undefined);
    };

    document.addEventListener('pointerover', preloadOnIntent);
    document.addEventListener('focusin', preloadOnIntent);
    document.addEventListener('touchstart', preloadOnIntent, { passive: true });

    return () => {
      document.removeEventListener('pointerover', preloadOnIntent);
      document.removeEventListener('focusin', preloadOnIntent);
      document.removeEventListener('touchstart', preloadOnIntent);
    };
  }, []);
};

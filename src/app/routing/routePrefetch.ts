/**
 * Idle prefetch of another route's files, listed by the build in `#route-prefetch` (see
 * `scripts/build/boot-routes.ts`). Files go into the HTTP cache without running, so the landing
 * page gains no Customizer CSS or code until the visitor opens the editor. Development documents
 * carry no list, so this does nothing there.
 */
const prefetched = new Set<string>();

const routeFiles = (route: string): string[] => {
  const manifest = document.getElementById('route-prefetch')?.textContent;
  if (!manifest) return [];
  try {
    const files = (JSON.parse(manifest) as Record<string, unknown>)[route];

    return Array.isArray(files) ? files.filter((file) => typeof file === 'string') : [];
  } catch {
    return [];
  }
};

export const prefetchRouteFiles = (route: 'customizer'): void => {
  for (const href of routeFiles(route)) {
    if (prefetched.has(href) || document.querySelector(`link[href="${href}"]`)) continue;
    prefetched.add(href);
    const link = document.createElement('link');

    link.rel = 'prefetch';
    link.href = href;
    /* Module scripts and Vite's stylesheet links are CORS requests; match them for cache reuse. */
    link.crossOrigin = '';
    document.head.append(link);
  }
};

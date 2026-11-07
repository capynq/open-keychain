/**
 * Routes that paint a server-rendered frame before React runs. Each entry names the frame
 * component, the variants the inline resolver in `index.html` chooses between, the page modules
 * whose stylesheets the frame needs, and the document it is written into.
 */

export const BOOT_LOCALES = ['en', 'ru', 'uk'] as const;
export const CUSTOMIZER_BOOT_TEMPLATES = [
  'name-keychain',
  'articulated-name',
  'magnet',
  'nameplate',
  'plant-label',
  'neutral',
] as const;

export type BootVariant = { key: string; props: Record<string, unknown> };

export type BootRoute = {
  id: 'landing' | 'customizer' | 'profile';
  /** Module and export that render one variant. */
  frame: { module: string; exportName: string };
  /** Path the frame's `MemoryRouter` starts at, so links resolve as on the live page. */
  routerPath: string;
  variants: BootVariant[];
  /** Variant written straight into the frame container, so the common case clones nothing. */
  inlineKey?: string;
  /**
   * Modules whose chunks carry the frame's stylesheets: the page itself and anything it loads
   * by dynamic import before its first paint. Production follows their static chunk imports.
   */
  rootModules: string[];
  /** Built document the frame is written into, relative to the output directory. */
  document: 'index.html' | 'create/index.html' | 'app.html';
  /** Development request paths that serve this route's frame. */
  devPaths: string[];
  /** UI faces the route paints with before React. */
  fontPreloads: string[];
  /** Whether the frame's own stylesheets are linked; the profile skeleton uses entry CSS only. */
  linksStylesheets: boolean;
  /** Removes ids and label targets so the frame never duplicates the live page's anchors. */
  stripIds: boolean;
  /**
   * Root modules whose chunks are preloaded at low priority, so they do not compete with the
   * stylesheets and code the frame and its hand-off wait on. Their CSS is still linked.
   */
  lowPriorityRootModules?: string[];
  /** A module export returning extra head markup for the document, such as image preloads. */
  head?: { module: string; exportName: string };
  /** Routes whose files this document lists for an idle prefetch (`#route-prefetch`). */
  prefetchRoutes?: BootRoute['id'][];
};

const NUNITO = '/fonts/nunito.ttf';
const BREE = '/fonts/bree-serif.ttf';

export const LANDING_BOOT_ROUTE: BootRoute = {
  id: 'landing',
  frame: { module: '/src/app/boot/LandingBootFrame.tsx', exportName: 'LandingBootFrame' },
  routerPath: '/',
  /* `/` renders English unless `?lang` asks otherwise; see `detectInitialLocale`. */
  variants: BOOT_LOCALES.map((locale) => ({ key: locale, props: { locale } })),
  inlineKey: 'en',
  rootModules: ['/src/pages/landing/LandingPage.tsx'],
  document: 'index.html',
  devPaths: ['/', '/index.html'],
  fontPreloads: [NUNITO, BREE],
  linksStylesheets: true,
  stripIds: true,
  head: {
    module: '/src/app/components/landing/ConfiguratorShowcase/hero-image.ts',
    exportName: 'heroImagePreloadTags',
  },
  /* Fetched at idle by useLandingIdlePrewarm, so opening the editor needs no network. */
  prefetchRoutes: ['customizer'],
};

export const CUSTOMIZER_BOOT_ROUTE: BootRoute = {
  id: 'customizer',
  frame: { module: '/src/app/boot/CustomizerBootFrame.tsx', exportName: 'CustomizerBootFrame' },
  routerPath: '/create',
  variants: BOOT_LOCALES.flatMap((locale) =>
    CUSTOMIZER_BOOT_TEMPLATES.map((templateId) => ({
      key: `${locale}:${templateId}`,
      props:
        templateId === 'neutral'
          ? { locale, neutral: true }
          : { locale, templateId, neutral: false },
    })),
  ),
  /* The Viewer arrives through a dynamic import that the server render never follows. */
  rootModules: [
    '/src/pages/customizer/CustomizerPage.tsx',
    '/src/features/preview/components/Viewer/Viewer.tsx',
  ],
  /* three.js is needed for the first draw, which also waits on the worker's first build. */
  lowPriorityRootModules: ['/src/features/preview/components/Viewer/Viewer.tsx'],
  document: 'create/index.html',
  devPaths: ['/create', '/create/'],
  fontPreloads: [NUNITO],
  linksStylesheets: true,
  stripIds: false,
};

/** The hosted profile keeps a generic skeleton, rendered from the same `RouteLoading` component. */
export const PROFILE_BOOT_ROUTE: BootRoute = {
  id: 'profile',
  frame: {
    module: '/src/app/components/RouteLoading/RouteLoading.tsx',
    exportName: 'RouteLoading',
  },
  routerPath: '/profile',
  variants: [{ key: 'skeleton', props: { locale: 'en', variant: 'profile' } }],
  rootModules: [],
  document: 'app.html',
  devPaths: ['/profile', '/profile/'],
  fontPreloads: [NUNITO, BREE],
  linksStylesheets: false,
  stripIds: false,
};

export const BOOT_ROUTES = [LANDING_BOOT_ROUTE, CUSTOMIZER_BOOT_ROUTE, PROFILE_BOOT_ROUTE];

/** Fonts for documents without a frame of their own (SEO, privacy and missing pages). */
export const FALLBACK_FONT_PRELOADS = [NUNITO, BREE];

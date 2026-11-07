import react from '@vitejs/plugin-react';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { createServer, type Plugin, type ResolvedConfig, type ViteDevServer } from 'vite';

import {
  BOOT_LOCALES,
  BOOT_ROUTES,
  CUSTOMIZER_BOOT_ROUTE,
  FALLBACK_FONT_PRELOADS,
  LANDING_BOOT_ROUTE,
  LOCALE_MODULES,
  PROFILE_BOOT_ROUTE,
  type BootRoute,
} from './boot-routes.ts';
import {
  collectChunkCss,
  collectChunkFiles,
  cssFilesDefining,
  entryChunks,
  entryCss,
  findChunkByFacade,
  missingBootClasses,
  orderStylesheets,
  type BootBundle,
} from './boot-styles.ts';

const FONT_PRELOADS = '<!-- route-font-preloads -->';
const BOOT_HEAD = '<!-- route-boot-head -->';
const BOOT_FRAMES = '<!-- route-boot-frames -->';
const DEV_ENTRY = '/src/main.tsx';

export const findGeometryWorkerHref = (bundle: Record<string, { fileName: string }>): string => {
  const workers = Object.values(bundle).filter((output) =>
    /^assets\/geometry-worker-[^/]+\.js$/.test(output.fileName),
  );
  if (workers.length !== 1)
    throw new Error(`Expected one geometry worker chunk, found ${workers.length}.`);
  return `/${workers[0].fileName}`;
};

/* Worker preload reused only without crossorigin */
export const geometryPreloadTags = (workerHref: string): string =>
  [
    `<link rel="modulepreload" href="${workerHref}">`,
    '<link rel="preload" href="/manifold-v1.wasm" as="fetch" crossorigin>',
  ].join('');

export const fontPreloadTags = (hrefs: string[]): string =>
  hrefs
    .map((href) => `<link rel="preload" href="${href}" as="font" type="font/ttf" crossorigin />`)
    .join('');

/** Route chunks the entry would only request after it runs; `crossorigin` matches module fetches. */
export const modulePreloadTags = (hrefs: string[], priority?: 'low'): string =>
  hrefs
    .map(
      (href) =>
        `<link rel="modulepreload" crossorigin href="${href}"${priority ? ` fetchpriority="${priority}"` : ''}>`,
    )
    .join('');

/** Files another route needs, for `src/app/routing/routePrefetch.ts` to prefetch at idle. */
export const routePrefetchManifest = (routes: Record<string, string[]>): string =>
  `<script type="application/json" id="route-prefetch">${JSON.stringify(routes).replace(/</g, '\\u003c')}</script>`;

/**
 * Starts the locale chunk the resolver in `index.html` picked (`data-boot-locale`) alongside the
 * entry, which would otherwise request it only after it runs.
 */
export const localePreloadScript = (files: Record<string, string[]>): string =>
  `<script>(()=>{for(const href of ${JSON.stringify(files).replace(/</g, '\\u003c')}[document.documentElement.dataset.bootLocale]??[]){const link=document.createElement('link');link.rel='modulepreload';link.crossOrigin='';link.href=href;document.head.append(link);}})()</script>`;

export const bootStylesheetLinks = (hrefs: string[]): string =>
  hrefs.map((href) => `<link rel="stylesheet" href="${href}" data-boot-style />`).join('');

/** Ids and label targets in a frame would shadow the live page's anchors during hand-off. */
export const stripFrameIds = (markup: string): string =>
  markup.replace(/\s(?:id|for)="[^"]*"/g, '');

/**
 * Frame markup for one route: the inline variant (painted without a clone) and a template per
 * other variant, keyed `route:key` for the resolver script in `index.html`.
 */
export const bootFrameMarkup = (
  route: Pick<BootRoute, 'id' | 'inlineKey'>,
  rendered: { key: string; markup: string }[],
): string =>
  rendered
    .map(({ key, markup }) =>
      key === route.inlineKey
        ? `<div data-boot-inline="${route.id}:${key}" style="display:contents">${markup}</div>`
        : `<template data-boot-frame="${route.id}:${key}">${markup}</template>`,
    )
    .join('');

/**
 * One served document. Preloads go where `index.html` marks them, ahead of Vite's entry tags;
 * frame stylesheets go last in the head, after the entry CSS, which is where the live page's
 * lazy chunks insert the same files, so equal-specificity rules resolve the same way.
 */
export const buildBootDocument = (
  html: string,
  {
    fonts,
    preloads = '',
    stylesheets = '',
    frames = '',
  }: { fonts: string[]; preloads?: string; stylesheets?: string; frames?: string },
): string => {
  for (const placeholder of [FONT_PRELOADS, BOOT_HEAD, BOOT_FRAMES, '</head>'])
    if (!html.includes(placeholder)) throw new Error(`index.html is missing ${placeholder}.`);
  return html
    .replace(FONT_PRELOADS, () => fontPreloadTags(fonts))
    .replace(BOOT_HEAD, () => preloads)
    .replace('</head>', () => `${stylesheets}</head>`)
    .replace(BOOT_FRAMES, () => frames);
};

/**
 * React's server renderer adds `<link rel="preload" as="image">` for every eager image. In a
 * frame those become live preloads for images the cloned `<img>` requests anyway, so drop them.
 */
export const stripImagePreloads = (markup: string): string =>
  markup.replace(/<link rel="preload" as="image"[^>]*>/g, '');

type ModuleGraphNode = {
  url: string;
  staticImportedUrls?: Set<string>;
  importedModules: Set<{ url: string }>;
};

const isStylesheet = (url: string) => /\.css$/.test(url);
const walkable = (url: string) => url.startsWith('/') && !url.includes('/node_modules/');

/**
 * Development stylesheets for a frame: every CSS module reached through static imports from
 * the app entry, the route's page modules and the frame, in evaluation order. Transforming does
 * not execute code, so the graph can be walked without a browser; each level is transformed in
 * parallel because it holds a few hundred modules.
 */
export const collectDevelopmentStyles = async (
  server: Pick<ViteDevServer, 'environments'>,
  roots: string[],
): Promise<string[]> => {
  const environment = server.environments.ssr;
  const imports = new Map<string, string[]>();
  let frontier = roots.filter(walkable);
  const seen = new Set(frontier);
  while (frontier.length) {
    const next: string[] = [];
    await Promise.all(
      frontier.map(async (url) => {
        /* Vite inlines a stylesheet's own @import rules, so its dependencies are not linked. */
        if (isStylesheet(url)) return;
        await environment.transformRequest(url);
        const node = (await environment.moduleGraph.getModuleByUrl(url)) as
          ModuleGraphNode | undefined;
        const urls = [
          ...(node?.staticImportedUrls ??
            new Set([...(node?.importedModules ?? [])].map((m) => m.url))),
        ].filter(walkable);
        imports.set(url, urls);
        for (const imported of urls) {
          if (seen.has(imported)) continue;
          seen.add(imported);
          next.push(imported);
        }
      }),
    );
    frontier = next;
  }
  return orderStylesheets(imports, roots);
};

type RenderedRoute = { route: BootRoute; frames: string; markup: string; head: string };

/** Paths served by `vite preview` the way `public/_redirects` serves them on Netlify. */
export const previewDocumentFor = (pathname: string, accept = ''): string | undefined => {
  if (pathname === '/create' || pathname === '/create/') return 'create/index.html';
  if (pathname === '/' || pathname === '/index.html') return undefined;
  if (pathname.startsWith('/api/') || path.posix.extname(pathname)) return undefined;
  return accept.includes('text/html') ? 'app.html' : undefined;
};

export const routeBootPlugin = (): Plugin => {
  let config: ResolvedConfig;
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  let builtRoutes: Promise<RenderedRoute[]> | undefined;
  let devRenderQueue = Promise.resolve();
  /** Any source edit can change a frame, so cached renders are keyed by a change counter. */
  let devGeneration = 0;
  const devFrames = new Map<
    string,
    { generation: number; frames: string; head: string; stylesheets: string[] }
  >();

  const getServer = async () => {
    if (server) return server;
    server = await createServer({
      configFile: false,
      root: config.root,
      resolve: config.resolve,
      cacheDir: path.join(
        path.dirname(config.cacheDir),
        `${path.basename(config.cacheDir)}-customizer-ssr`,
      ),
      plugins: [react()],
      server: { middlewareMode: true, ws: false },
      optimizeDeps: { noDiscovery: true, include: [] },
      appType: 'custom',
      logLevel: 'error',
    });
    return server;
  };

  const closeSsrServer = async () => {
    const activeServer = server;
    server = undefined;
    await activeServer?.close();
  };

  const renderRoute = async (route: BootRoute): Promise<RenderedRoute> => {
    const ssrServer = await getServer();
    const { loadLocale } = (await ssrServer.ssrLoadModule(
      '/src/infrastructure/i18n/config.ts',
    )) as {
      loadLocale: (locale: string) => Promise<void>;
    };
    await Promise.all(BOOT_LOCALES.map((locale) => loadLocale(locale)));
    const [frameModule, { AnalyticsContext }] = await Promise.all([
      ssrServer.ssrLoadModule(route.frame.module),
      ssrServer.ssrLoadModule('/src/infrastructure/telemetry/telemetry-context.ts'),
    ]);
    const Frame = frameModule[route.frame.exportName] as ComponentType<Record<string, unknown>>;
    const head = route.head
      ? (
          (await ssrServer.ssrLoadModule(route.head.module))[route.head.exportName] as () => string
        )()
      : '';
    const analytics = {
      consent: 'declined' as const,
      setConsent: () => undefined,
      track: () => undefined,
    };
    const rendered = route.variants.map(({ key, props }) => {
      const tree = createElement(
        AnalyticsContext.Provider,
        { value: analytics },
        createElement(
          MemoryRouter,
          { initialEntries: [route.routerPath] },
          createElement(Frame, props),
        ),
      ) as ReactNode;
      const markup = stripImagePreloads(renderToStaticMarkup(tree));
      return { key, markup: route.stripIds ? stripFrameIds(markup) : markup };
    });
    return {
      route,
      frames: bootFrameMarkup(route, rendered),
      markup: rendered.map(({ markup }) => markup).join(''),
      head,
    };
  };

  /** Build renders once, alongside bundling; the result is awaited when the bundle is final. */
  const buildRoutes = () => {
    builtRoutes ??= (async () => {
      const routes: RenderedRoute[] = [];
      for (const route of BOOT_ROUTES) routes.push(await renderRoute(route));
      return routes;
    })().finally(closeSsrServer);
    return builtRoutes;
  };

  const devDocument = async (html: string, pathname: string | undefined): Promise<string> => {
    const route = BOOT_ROUTES.find((entry) => entry.devPaths.includes(pathname ?? ''));
    if (!route) return buildBootDocument(html, { fonts: FALLBACK_FONT_PRELOADS });

    /* Serialize render+close across concurrent requests */
    const previousRender = devRenderQueue;
    let releaseRender!: () => void;
    devRenderQueue = new Promise<void>((resolve) => {
      releaseRender = resolve;
    });
    await previousRender;
    try {
      let cached = devFrames.get(route.id);
      if (cached?.generation !== devGeneration) {
        const generation = devGeneration;
        try {
          const { frames, head } = await renderRoute(route);
          const stylesheets = route.linksStylesheets
            ? await collectDevelopmentStyles(await getServer(), [
                DEV_ENTRY,
                ...route.rootModules,
                route.frame.module,
              ])
            : [];
          cached = { generation, frames, head, stylesheets };
          devFrames.set(route.id, cached);
        } finally {
          await closeSsrServer();
        }
      }
      return buildBootDocument(html, {
        fonts: route.fontPreloads,
        preloads: cached.head,
        stylesheets: bootStylesheetLinks(cached.stylesheets),
        frames: cached.frames,
      });
    } finally {
      releaseRender();
    }
  };

  return {
    name: 'route-boot-frames',
    configResolved(resolved) {
      config = resolved;
    },
    buildStart() {
      if (config.command !== 'build') return;
      /* Observed in generateBundle; the catch keeps an early failure from going unhandled. */
      buildRoutes().catch(() => undefined);
    },
    async transformIndexHtml(html, context) {
      if (config.command !== 'serve') return html;
      return devDocument(html, (context?.originalUrl ?? context?.path)?.split('?')[0]);
    },
    generateBundle: {
      /* After vite:css-post folds CSS-only chunks into their importers' CSS lists, and after
       * vite:build-html has written the final index.html into the bundle. */
      order: 'post',
      async handler(_options, outputBundle) {
        if (config.command !== 'build') return;
        const bundle = outputBundle as unknown as BootBundle;
        const htmlAsset = bundle['index.html'];
        if (htmlAsset?.type !== 'asset') this.error('The built index.html is missing.');
        const html = String(htmlAsset.source);
        const linkedByEntry = entryCss(bundle);
        const source = (file: string) => {
          const output = bundle[file];
          return output?.type === 'asset' ? String(output.source) : '';
        };
        const linkedChunks = entryChunks(bundle);
        const rendered = await buildRoutes();
        const assets = new Map(
          rendered.map(({ route }) => {
            const roots = route.rootModules.map((module) =>
              findChunkByFacade(bundle, path.join(config.root, module)),
            );
            const lowPriority = new Set(route.lowPriorityRootModules ?? []);
            const primaryRoots = roots.filter(
              (_, index) => !lowPriority.has(route.rootModules[index]),
            );
            const js = collectChunkFiles(bundle, primaryRoots, linkedChunks);
            const lowJs = collectChunkFiles(bundle, roots, linkedChunks).filter(
              (file) => !js.includes(file),
            );
            return [
              route.id,
              {
                css: route.linksStylesheets ? collectChunkCss(bundle, roots, linkedByEntry) : [],
                js,
                lowJs,
              },
            ];
          }),
        );
        const localeFiles = Object.fromEntries(
          Object.entries(LOCALE_MODULES).map(([locale, module]) => [
            locale,
            collectChunkFiles(
              bundle,
              [findChunkByFacade(bundle, path.join(config.root, module))],
              linkedChunks,
            ).map((file) => `/${file}`),
          ]),
        );
        const documents = new Map<string, string>();

        for (const { route, frames, markup, head } of rendered) {
          const { css, js, lowJs } = assets.get(route.id)!;
          const missing = missingBootClasses(markup, [...linkedByEntry, ...css].map(source));
          if (missing.length) {
            this.error(
              `The ${route.id} boot frame uses classes no boot stylesheet defines: ${missing
                .map(
                  (token) => `${token} (${cssFilesDefining(bundle, token).join(', ') || 'no CSS'})`,
                )
                .join('; ')}`,
            );
          }
          const prefetch = Object.fromEntries(
            (route.prefetchRoutes ?? []).map((id) => {
              const target = assets.get(id)!;
              return [id, [...target.js, ...target.lowJs, ...target.css].map((file) => `/${file}`)];
            }),
          );
          const preloads = [
            localePreloadScript(localeFiles),
            route === CUSTOMIZER_BOOT_ROUTE
              ? geometryPreloadTags(findGeometryWorkerHref(bundle))
              : '',
            head,
            route.prefetchRoutes?.length ? routePrefetchManifest(prefetch) : '',
          ].join('');
          /* Route code follows the stylesheets the frame's first paint waits on, so connections
           * without request priorities fetch the CSS first. */
          const modulePreloads =
            modulePreloadTags(js.map((file) => `/${file}`)) +
            modulePreloadTags(
              lowJs.map((file) => `/${file}`),
              'low',
            );
          documents.set(
            route.document,
            buildBootDocument(html, {
              fonts: route.fontPreloads,
              preloads,
              stylesheets: bootStylesheetLinks(css.map((file) => `/${file}`)) + modulePreloads,
              frames,
            }),
          );
        }

        htmlAsset.source = documents.get(LANDING_BOOT_ROUTE.document)!;
        for (const route of [CUSTOMIZER_BOOT_ROUTE, PROFILE_BOOT_ROUTE]) {
          this.emitFile({
            type: 'asset',
            fileName: route.document,
            source: documents.get(route.document)!,
          });
        }
      },
    },
    configureServer(viteServer) {
      const sourceDirectory = path.join(config.root, 'src') + path.sep;
      viteServer.watcher.on('all', (_event, file) => {
        if (file.startsWith(sourceDirectory)) devGeneration += 1;
      });
      viteServer.httpServer?.once('close', () => {
        void closeSsrServer();
      });
    },
    configurePreviewServer(previewServer) {
      const outDir = path.resolve(config.root, config.build.outDir);
      previewServer.middlewares.use(async (request, response, next) => {
        const pathname = decodeURIComponent(request.url?.split('?')[0] ?? '/');
        const document = previewDocumentFor(pathname, request.headers.accept);
        const isFile = await stat(path.join(outDir, pathname))
          .then((entry) => entry.isFile())
          .catch(() => false);
        if (!document || isFile || (request.method !== 'GET' && request.method !== 'HEAD')) {
          next();
          return;
        }
        try {
          const html = await readFile(path.join(outDir, document));
          response.statusCode = 200;
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.end(request.method === 'HEAD' ? undefined : html);
        } catch (error) {
          next(error);
        }
      });
    },
    async closeBundle() {
      await closeSsrServer();
    },
  };
};

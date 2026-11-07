import react from '@vitejs/plugin-react';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { createServer, type Plugin, type ResolvedConfig, type ViteDevServer } from 'vite';

import {
  collectChunkCss,
  cssFilesDefining,
  entryCss,
  findChunkByFacade,
  missingBootClasses,
  orderStylesheets,
  type BootBundle,
} from './boot-styles.ts';

const locales = ['en', 'ru', 'uk'] as const;
const templates = [
  'name-keychain',
  'articulated-name',
  'magnet',
  'nameplate',
  'plant-label',
  'neutral',
] as const;
const placeholder = '<!-- customizer-boot-variants -->';
const bootStylesPlaceholder = '__CUSTOMIZER_BOOT_STYLE_URLS__';
const frameModule = '/src/app/boot/CustomizerBootFrame.tsx';
const devEntryModule = '/src/main.tsx';
/**
 * The boot frame renders the Customizer page and its preview, and the Viewer arrives through a
 * dynamic import that the server render never follows, so it is a root of its own.
 */
const bootRootModules = [
  '/src/pages/customizer/CustomizerPage.tsx',
  '/src/features/preview/components/Viewer/Viewer.tsx',
];

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

export const bootStylesheetLinks = (hrefs: string[]): string =>
  hrefs
    .map((href) => `<link rel="stylesheet" href="${href}" data-customizer-boot-style />`)
    .join('');

export const buildCustomizerDocument = (
  html: string,
  bootStyleUrls: string[],
  geometryWorkerHref: string,
  variants: string,
): string =>
  html
    .replace(bootStylesPlaceholder, '[]')
    .replace(
      '</head>',
      () =>
        `${geometryPreloadTags(geometryWorkerHref)}${bootStylesheetLinks(bootStyleUrls)}</head>`,
    )
    .replace(placeholder, () => variants);

type ModuleGraphNode = {
  url: string;
  staticImportedUrls?: Set<string>;
  importedModules: Set<{ url: string }>;
};

const isStylesheet = (url: string) => /\.css$/.test(url);
const walkable = (url: string) => url.startsWith('/') && !url.includes('/node_modules/');

/**
 * Development stylesheets for the frame: every CSS module reached through static imports from
 * the app entry and the boot roots, in evaluation order. Transforming does not execute code, so
 * the entry and the Viewer can be walked without a browser; each level is transformed in
 * parallel because the graph holds a few hundred modules.
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

export const customizerBootPlugin = (): Plugin => {
  let config: ResolvedConfig;
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  let renderedVariants: Promise<string> | undefined;
  let bootStyleUrls: string[] = [];
  let geometryWorkerHref: string | undefined;
  let devRenderQueue = Promise.resolve();
  /** Any source edit can change the frame, so the cached render is keyed by a change counter. */
  let devGeneration = 0;
  let devFrame: { generation: number; variants: string; stylesheets: string[] } | undefined;

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

  const renderVariants = async (): Promise<string> => {
    const ssrServer = await getServer();
    await ssrServer.ssrLoadModule('/src/infrastructure/i18n/config.ts');
    const [{ CustomizerBootFrame }, { AnalyticsContext }] = await Promise.all([
      ssrServer.ssrLoadModule(frameModule),
      ssrServer.ssrLoadModule('/src/infrastructure/telemetry/telemetry-context.ts'),
    ]);
    const value = {
      consent: 'declined' as const,
      setConsent: () => undefined,
      track: () => undefined,
    };
    const variants: string[] = [];

    for (const locale of locales) {
      for (const templateId of templates) {
        const neutral = templateId === 'neutral';
        const frame = createElement(CustomizerBootFrame, {
          locale,
          ...(neutral ? {} : { templateId }),
          neutral,
        });
        const wrapped = createElement(
          AnalyticsContext.Provider,
          { value },
          createElement(MemoryRouter, { initialEntries: ['/create'] }, frame),
        ) as ReactNode;
        variants.push(
          `<template data-customizer-boot="${locale}:${templateId}">${renderToStaticMarkup(wrapped)}</template>`,
        );
      }
    }
    return variants.join('');
  };

  /** Build renders once, alongside bundling; the result is awaited when the bundle is final. */
  const buildVariants = () => {
    renderedVariants ??= renderVariants().finally(closeSsrServer);
    return renderedVariants;
  };

  return {
    name: 'customizer-boot-variants',
    configResolved(resolved) {
      config = resolved;
    },
    buildStart() {
      if (config.command !== 'build') return;
      /* Observed in generateBundle; the catch keeps an early failure from going unhandled. */
      buildVariants().catch(() => undefined);
    },
    async transformIndexHtml(html, context) {
      const withStyles = html.replace(
        bootStylesPlaceholder,
        config.command === 'serve' ? '[]' : bootStylesPlaceholder,
      );
      if (!withStyles.includes(placeholder)) return withStyles;
      if (config.command !== 'serve') return withStyles;

      const pathname = (context?.originalUrl ?? context?.path)?.split('?')[0];
      if (pathname !== '/create' && pathname !== '/create/') return withStyles;

      /* Serialize render+close across concurrent requests */
      const previousRender = devRenderQueue;
      let releaseRender!: () => void;
      devRenderQueue = new Promise<void>((resolve) => {
        releaseRender = resolve;
      });
      await previousRender;
      try {
        if (devFrame?.generation !== devGeneration) {
          const generation = devGeneration;
          try {
            const variants = await renderVariants();
            const stylesheets = await collectDevelopmentStyles(await getServer(), [
              devEntryModule,
              frameModule,
              ...bootRootModules,
            ]);
            devFrame = { generation, variants, stylesheets };
          } finally {
            await closeSsrServer();
          }
        }
        const { variants, stylesheets } = devFrame!;
        const withStylesheets = withStyles.replace(
          '</head>',
          () => `${bootStylesheetLinks(stylesheets)}</head>`,
        );
        return withStylesheets.replace(placeholder, () => variants);
      } finally {
        releaseRender();
      }
    },
    generateBundle: {
      /* After vite:css-post, which folds CSS-only chunks into their importers' CSS lists. */
      order: 'post',
      async handler(_options, outputBundle) {
        if (config.command !== 'build') return;
        const bundle = outputBundle as unknown as BootBundle;
        const roots = bootRootModules.map((module) =>
          findChunkByFacade(bundle, path.join(config.root, module)),
        );
        const linkedByEntry = entryCss(bundle);
        const bootCss = collectChunkCss(bundle, roots, linkedByEntry);
        if (!bootCss.length) this.error('The Customizer boot roots emitted no CSS.');
        bootStyleUrls = bootCss.map((file) => `/${file}`);
        geometryWorkerHref = findGeometryWorkerHref(bundle);

        const source = (file: string) => {
          const output = bundle[file];
          return output?.type === 'asset' ? String(output.source) : '';
        };
        const missing = missingBootClasses(
          await buildVariants(),
          [...linkedByEntry, ...bootCss].map(source),
        );
        if (missing.length) {
          this.error(
            `The Customizer boot frame uses classes no boot stylesheet defines: ${missing
              .map(
                (token) => `${token} (${cssFilesDefining(bundle, token).join(', ') || 'no CSS'})`,
              )
              .join('; ')}`,
          );
        }
      },
    },
    async writeBundle(outputOptions) {
      if (config.command !== 'build') return;
      const outputDir = path.resolve(config.root, outputOptions.dir ?? config.build.outDir);
      const htmlPath = path.join(outputDir, 'index.html');
      const html = await readFile(htmlPath, 'utf8');
      if (!html.includes(bootStylesPlaceholder)) {
        this.error('The Customizer boot stylesheet URL placeholder is missing from index.html.');
      }
      const preparedHtml = html
        .replace(bootStylesPlaceholder, JSON.stringify(bootStyleUrls))
        .replace(placeholder, '');
      await writeFile(htmlPath, preparedHtml);

      const customizerHtml = buildCustomizerDocument(
        html,
        bootStyleUrls,
        geometryWorkerHref!,
        await buildVariants(),
      );
      const customizerHtmlPath = path.join(outputDir, 'create', 'index.html');
      await mkdir(path.dirname(customizerHtmlPath), { recursive: true });
      await writeFile(customizerHtmlPath, customizerHtml);
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
      previewServer.middlewares.use(async (request, response, next) => {
        const pathname = request.url?.split('?')[0];
        if (pathname !== '/create' && pathname !== '/create/') {
          next();
          return;
        }
        try {
          const html = await readFile(
            path.join(config.root, config.build.outDir, 'create', 'index.html'),
          );
          response.statusCode = 200;
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.end(html);
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

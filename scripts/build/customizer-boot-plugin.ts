import react from '@vitejs/plugin-react';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { createServer, type Plugin, type ResolvedConfig } from 'vite';

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
const developmentBootStyles = [
  '/src/app/styles/tokens.css',
  '/src/app/styles/global.css',
  '/src/app/styles/app.css',
  '/src/app/styles/customizer.css',
  '/src/app/styles/preview.css',
  '/src/features/preview/styles/preview.css',
  '/src/app/boot/CustomizerBootFrame.css',
  '/src/app/components/CustomizerNavigationHeader/CustomizerNavigationHeader.module.css',
  '/src/app/components/PreviewPanel/PreviewPanel.module.css',
  '/src/features/customizer/components/ControlsPanel/ControlsPanel.module.css',
  '/src/features/customizer/components/ControlsPanel/AppearanceControls.module.css',
  '/src/features/customizer/components/ControlsPanel/SimpleOptions.module.css',
  '/src/features/customizer/components/ControlsPanel/SimpleFontCarousel.module.css',
  '/src/shared/ui/ColorControl.module.css',
  '/src/features/customizer/components/DesignCardRail/DesignCardRail.module.css',
  '/src/features/customizer/components/DesignSelectCard/DesignSelectCard.module.css',
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

export const buildCustomizerDocument = (
  html: string,
  bootStyleUrls: string[],
  geometryWorkerHref: string,
  variants: string,
): string => {
  const stylesheetLinks = bootStyleUrls
    .map((href) => `<link rel="stylesheet" href="${href}" data-customizer-boot-style />`)
    .join('');
  return html
    .replace(bootStylesPlaceholder, '[]')
    .replace('</head>', `${geometryPreloadTags(geometryWorkerHref)}${stylesheetLinks}</head>`)
    .replace(placeholder, () => variants);
};

export const customizerBootPlugin = (): Plugin => {
  let config: ResolvedConfig;
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  let renderedVariants: string | undefined;
  let bootStyleUrls: string[] = [];
  let geometryWorkerHref: string | undefined;
  let devRenderQueue = Promise.resolve();

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
    if (renderedVariants && config.command === 'build') return renderedVariants;
    const ssrServer = await getServer();
    await ssrServer.ssrLoadModule('/src/infrastructure/i18n/config.ts');
    const [{ CustomizerBootFrame }, { AnalyticsContext }] = await Promise.all([
      ssrServer.ssrLoadModule('/src/app/boot/CustomizerBootFrame.tsx'),
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
    renderedVariants = variants.join('');
    return renderedVariants;
  };

  return {
    name: 'customizer-boot-variants',
    configResolved(resolved) {
      config = resolved;
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
        const stylesheetLinks = developmentBootStyles
          .map((href) => `<link rel="stylesheet" href="${href}" data-customizer-boot-style />`)
          .join('');
        const withStylesheets = withStyles.replace('</head>', `${stylesheetLinks}</head>`);
        return withStylesheets.replace(placeholder, await renderVariants());
      } finally {
        try {
          await closeSsrServer();
        } finally {
          releaseRender();
        }
      }
    },
    generateBundle(_options, bundle) {
      if (config.command !== 'build') return;
      const bootChunks = new Set([
        'customizerBootStyles',
        'CustomizerPage',
        'preview',
        'Viewer',
        'AppHeader',
      ]);
      bootStyleUrls = [
        ...new Set(
          Object.values(bundle).flatMap((output) =>
            output.type === 'chunk' && bootChunks.has(output.name)
              ? [...(output.viteMetadata?.importedCss ?? [])]
              : [],
          ),
        ),
      ].map((file) => `/${file}`);
      if (!bootStyleUrls.length) this.error('The Customizer boot stylesheet entry emitted no CSS.');
      geometryWorkerHref = findGeometryWorkerHref(bundle);
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
        await renderVariants(),
      );
      const customizerHtmlPath = path.join(outputDir, 'create', 'index.html');
      await mkdir(path.dirname(customizerHtmlPath), { recursive: true });
      await writeFile(customizerHtmlPath, customizerHtml);
    },
    configureServer(viteServer) {
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

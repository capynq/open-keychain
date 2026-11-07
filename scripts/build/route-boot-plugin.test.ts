import { describe, expect, it } from 'vitest';

import { BOOT_ROUTES, CUSTOMIZER_BOOT_ROUTE, LANDING_BOOT_ROUTE } from './boot-routes.ts';
import {
  bootFrameMarkup,
  bootStylesheetLinks,
  buildBootDocument,
  findGeometryWorkerHref,
  geometryPreloadTags,
  previewDocumentFor,
  stripFrameIds,
  stripImagePreloads,
} from './route-boot-plugin.ts';

describe('findGeometryWorkerHref', () => {
  it('returns the single emitted geometry worker chunk', () => {
    expect(
      findGeometryWorkerHref({
        'assets/app-1.js': { fileName: 'assets/app-1.js' },
        'assets/geometry-worker-AbC.js': { fileName: 'assets/geometry-worker-AbC.js' },
      }),
    ).toBe('/assets/geometry-worker-AbC.js');
  });

  it('fails when the worker chunk is missing or ambiguous', () => {
    expect(() => findGeometryWorkerHref({})).toThrow('found 0');
    expect(() =>
      findGeometryWorkerHref({
        'assets/geometry-worker-a.js': { fileName: 'assets/geometry-worker-a.js' },
        'assets/geometry-worker-b.js': { fileName: 'assets/geometry-worker-b.js' },
      }),
    ).toThrow('found 2');
  });
});

describe('geometryPreloadTags', () => {
  it('preloads the worker script and the WASM binary without crossorigin on the worker', () => {
    expect(geometryPreloadTags('/assets/geometry-worker-AbC.js')).toBe(
      '<link rel="modulepreload" href="/assets/geometry-worker-AbC.js">' +
        '<link rel="preload" href="/manifold-v1.wasm" as="fetch" crossorigin>',
    );
  });
});

describe('buildBootDocument', () => {
  const html =
    '<html><head><!-- route-font-preloads --><!-- route-boot-head -->' +
    '<link rel="stylesheet" crossorigin href="/assets/app.css"></head>' +
    '<body><div id="boot-frame"><!-- route-boot-frames --></div></body></html>';

  it('puts preloads at the placeholder and frame stylesheets after the entry tags', () => {
    expect(
      buildBootDocument(html, {
        fonts: ['/fonts/nunito.ttf'],
        preloads: '<link rel="modulepreload" href="/assets/w.js">',
        stylesheets: bootStylesheetLinks(['/assets/a.css']),
        frames: '<template>V</template>',
      }),
    ).toBe(
      '<html><head><link rel="preload" href="/fonts/nunito.ttf" as="font" type="font/ttf" crossorigin />' +
        '<link rel="modulepreload" href="/assets/w.js"><link rel="stylesheet" crossorigin href="/assets/app.css">' +
        '<link rel="stylesheet" href="/assets/a.css" data-boot-style /></head>' +
        '<body><div id="boot-frame"><template>V</template></div></body></html>',
    );
  });

  it('leaves the fallback document without frames or boot head tags', () => {
    expect(buildBootDocument(html, { fonts: [] })).toBe(
      '<html><head><link rel="stylesheet" crossorigin href="/assets/app.css"></head>' +
        '<body><div id="boot-frame"></div></body></html>',
    );
  });

  it('keeps replacement patterns in rendered markup literal', () => {
    expect(buildBootDocument(html, { fonts: [], frames: '<p>$& $1 $$</p>' })).toContain(
      '<p>$& $1 $$</p>',
    );
  });

  it('fails when index.html lost a placeholder', () => {
    expect(() => buildBootDocument('<html></html>', { fonts: [] })).toThrow('route-font-preloads');
  });
});

describe('bootFrameMarkup', () => {
  it('writes the inline variant in place and every other variant as a template', () => {
    expect(
      bootFrameMarkup(LANDING_BOOT_ROUTE, [
        { key: 'en', markup: '<b>en</b>' },
        { key: 'ru', markup: '<b>ru</b>' },
      ]),
    ).toBe(
      '<div data-boot-inline="landing:en" style="display:contents"><b>en</b></div>' +
        '<template data-boot-frame="landing:ru"><b>ru</b></template>',
    );
  });
});

describe('stripImagePreloads', () => {
  it('drops the image preloads React adds for eager images', () => {
    expect(
      stripImagePreloads('<link rel="preload" as="image" href="/a.png"/><img src="/a.png"/>'),
    ).toBe('<img src="/a.png"/>');
  });
});

describe('stripFrameIds', () => {
  it('drops ids and label targets but keeps data attributes', () => {
    expect(
      stripFrameIds('<section id="how-it-works" data-id="x"><label for="r1">A</label></section>'),
    ).toBe('<section data-id="x"><label>A</label></section>');
  });
});

describe('boot routes', () => {
  it('render each document once and give the Customizer every locale and template', () => {
    expect(new Set(BOOT_ROUTES.map((route) => route.document)).size).toBe(BOOT_ROUTES.length);
    expect(CUSTOMIZER_BOOT_ROUTE.variants).toHaveLength(18);
    expect(LANDING_BOOT_ROUTE.variants.map((variant) => variant.key)).toEqual(['en', 'ru', 'uk']);
  });
});

describe('previewDocumentFor', () => {
  const html = 'text/html,application/xhtml+xml';

  it('serves the documents public/_redirects serves on Netlify', () => {
    expect(previewDocumentFor('/create', html)).toBe('create/index.html');
    expect(previewDocumentFor('/create/', html)).toBe('create/index.html');
    expect(previewDocumentFor('/', html)).toBeUndefined();
    expect(previewDocumentFor('/ru/', html)).toBe('app.html');
    expect(previewDocumentFor('/privacy', html)).toBe('app.html');
  });

  it('leaves assets, API calls and non-document requests alone', () => {
    expect(previewDocumentFor('/assets/app.js', html)).toBeUndefined();
    expect(previewDocumentFor('/api/v1/account', html)).toBeUndefined();
    expect(previewDocumentFor('/ru/', '*/*')).toBeUndefined();
  });
});

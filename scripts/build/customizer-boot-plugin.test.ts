import { describe, expect, it } from 'vitest';

import {
  buildCustomizerDocument,
  findGeometryWorkerHref,
  geometryPreloadTags,
} from './customizer-boot-plugin';

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

describe('buildCustomizerDocument', () => {
  const html = `<html><head><meta charset="utf-8" /><!-- route-font-preloads --><script>__CUSTOMIZER_BOOT_STYLE_URLS__</script></head><body><!-- customizer-boot-variants --></body></html>`;

  it('injects preloads and stylesheets into the head and the variants into the body', () => {
    const result = buildCustomizerDocument(
      html,
      ['/assets/a.css'],
      '/assets/geometry-worker-x.js',
      '<template>V</template>',
    );

    expect(result).toContain('<script>[]</script>');
    expect(result).toContain(
      '<link rel="preload" href="/fonts/nunito.ttf" as="font" type="font/ttf" crossorigin /><script>',
    );
    expect(result).not.toContain('bree-serif');
    expect(result).toContain(
      '<link rel="modulepreload" href="/assets/geometry-worker-x.js"><link rel="preload" href="/manifold-v1.wasm" as="fetch" crossorigin><link rel="stylesheet" href="/assets/a.css" data-customizer-boot-style /></head>',
    );
    expect(result).toContain('<body><template>V</template></body>');
    expect(result).not.toContain('__CUSTOMIZER_BOOT_STYLE_URLS__');
  });

  it('keeps replacement patterns in rendered markup literal', () => {
    const result = buildCustomizerDocument(
      html,
      [],
      '/assets/geometry-worker-x.js',
      '<p>$& $1 $$</p>',
    );

    expect(result).toContain('<body><p>$& $1 $$</p></body>');
  });
});

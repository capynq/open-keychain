import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { appSeoCanonical, buildSeoJsonLd, resolveAppSeoUrl, seoOgImagePath } from './app-metadata';
import { resolveSeoRoute } from './catalog';

describe('customizer SEO URL resolver', () => {
  it('accepts only localized bare and template URLs', () => {
    expect(resolveAppSeoUrl('/create', '?lang=ru')).toEqual({ indexable: true, locale: 'ru' });
    expect(resolveAppSeoUrl('/create', '?template=plant-label&lang=uk')).toEqual({
      indexable: true,
      locale: 'uk',
      template: 'plant-label',
    });
    expect(resolveAppSeoUrl('/create', '')).toMatchObject({ indexable: false });
    expect(resolveAppSeoUrl('/create', '?lang=en&design=bad')).toMatchObject({ indexable: false });
    expect(resolveAppSeoUrl('/create', '?template=magnet&lang=en')).toMatchObject({
      indexable: false,
    });
  });

  it('keeps non-normalized variants out of the index', () => {
    expect(appSeoCanonical('/create', '?lang=uk&template=nameplate')).toBe(
      'https://open-keychain.com/create?lang=uk&template=nameplate',
    );
    expect(resolveAppSeoUrl('/create', '?lang=uk&template=nameplate')).toMatchObject({
      indexable: false,
    });
  });

  it('selects route artwork for social previews', () => {
    expect(seoOgImagePath(resolveSeoRoute('/ru/templates/nameplate/')!)).toBe(
      '/showcase/templates/nameplate.png',
    );
    expect(seoOgImagePath(resolveSeoRoute('/uk/guides/stl-vs-3mf/')!)).toBe(
      '/showcase/prints/example_1-en.png',
    );
    expect(seoOgImagePath(resolveSeoRoute('/uk/guides/')!)).toBe('/brand/open-keychain-og.png');
  });

  it('builds breadcrumbs through the localized hub before the detail page', () => {
    const graph = buildSeoJsonLd(resolveSeoRoute('/ru/templates/nameplate/')!)['@graph'] as Array<
      Record<string, unknown>
    >;
    const breadcrumb = graph.find((item) => item['@type'] === 'BreadcrumbList') as Record<
      string,
      unknown
    >;
    expect(breadcrumb.itemListElement).toEqual([
      expect.objectContaining({
        position: 1,
        item: 'https://open-keychain.com/ru/',
      }),
      expect.objectContaining({
        position: 2,
        item: 'https://open-keychain.com/ru/templates/',
      }),
      expect.objectContaining({
        position: 3,
        item: 'https://open-keychain.com/ru/templates/nameplate/',
      }),
    ]);
  });

  it('uses Article schema for guides without claiming every page is an application', () => {
    const graph = buildSeoJsonLd(resolveSeoRoute('/uk/guides/stl-vs-3mf/')!)['@graph'] as Array<
      Record<string, unknown>
    >;
    const article = graph.find((item) => item['@type'] === 'Article');
    expect(article).toMatchObject({
      headline: expect.any(String),
      image: 'https://open-keychain.com/showcase/prints/example_1-en.png',
      dateModified: '2026-08-22',
    });
    expect(graph.some((item) => item['@type'] === 'WebApplication')).toBe(false);
  });

  it('keeps sitemap guide images aligned with the catalog', () => {
    const sitemap = readFileSync(new URL('../../../public/sitemap.xml', import.meta.url), 'utf8');
    for (const locale of ['en', 'ru', 'uk'] as const) {
      const route = resolveSeoRoute(
        locale === 'en' ? '/guides/stl-vs-3mf/' : `/${locale}/guides/stl-vs-3mf/`,
      );
      const image = seoOgImagePath(route!);
      const escapedPath = route!.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const entry = sitemap.match(
        new RegExp(
          `<loc>https://open-keychain\\.com${escapedPath}</loc>[\\s\\S]*?<image:loc>https://open-keychain\\.com([^<]+)</image:loc>`,
        ),
      );
      expect(entry?.[1]).toBe(image);
    }
  });
});

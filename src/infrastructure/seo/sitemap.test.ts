import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { SEO_SITEMAP_MANIFEST } from './catalog';
import { buildSeoSitemapXml, seoSitemapImagePath } from './sitemap';

const sitemap = readFileSync(new URL('../../../public/sitemap.xml', import.meta.url), 'utf8');
const decodeXml = (value: string): string =>
  value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

describe('SEO sitemap', () => {
  it('matches every canonical route in the published manifest', () => {
    const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
      decodeXml(match[1]),
    );

    expect(locations).toHaveLength(48);
    expect(new Set(locations).size).toBe(locations.length);
    expect(locations).toEqual(
      SEO_SITEMAP_MANIFEST.map((entry) => `https://open-keychain.com${entry.path}`),
    );
    expect(locations).not.toContain('https://open-keychain.com/privacy');
    expect(locations).not.toContain('https://open-keychain.com/profile');
  });

  it('stays deterministic and escapes query URLs for XML', () => {
    expect(sitemap).toBe(buildSeoSitemapXml());
    expect(sitemap).toContain(
      '<loc>https://open-keychain.com/create?template=name-keychain&amp;lang=en</loc>',
    );
  });

  it('keeps each page lastmod and image aligned with its manifest entry', () => {
    for (const entry of SEO_SITEMAP_MANIFEST) {
      const location = `https://open-keychain.com${entry.path}`;
      const escapedLocation = location.replace(/&/g, '&amp;');
      const entryXml = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)]
        .map((match) => match[1])
        .find((block) => block.includes(`<loc>${escapedLocation}</loc>`));

      expect(entryXml).toContain(`<lastmod>${entry.lastModified}</lastmod>`);
      expect(entryXml).toContain(
        `<image:loc>https://open-keychain.com${seoSitemapImagePath(entry)}</image:loc>`,
      );
    }
  });
});

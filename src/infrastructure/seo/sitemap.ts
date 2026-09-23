import { defaultSeoOgImagePath } from './app-metadata';
import { SEO_GUIDE_CATALOG, SEO_SITEMAP_MANIFEST, SEO_TEMPLATE_CATALOG } from './catalog';

const SITE_ORIGIN = 'https://open-keychain.com';

const escapeXml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const escaped: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
    };
    return escaped[character] ?? character;
  });

export const seoSitemapImagePath = (entry: (typeof SEO_SITEMAP_MANIFEST)[number]): string => {
  if (entry.kind === 'guide') {
    const guide = SEO_GUIDE_CATALOG.find((candidate) => candidate.slug === entry.guideSlug);
    if (!guide) throw new Error(`Missing sitemap guide image for ${entry.path}`);
    return guide.ogImageSrc;
  }
  if (entry.kind === 'template') {
    const template = SEO_TEMPLATE_CATALOG.find((candidate) => candidate.id === entry.templateId);
    if (!template) throw new Error(`Missing sitemap template image for ${entry.path}`);
    return template.previewSrc;
  }
  return defaultSeoOgImagePath;
};

const isValidDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

/** Render the deterministic XML sitemap from the canonical route manifest. */
export const buildSeoSitemapXml = (): string => {
  const entries = SEO_SITEMAP_MANIFEST.map((entry) => {
    if (!isValidDate(entry.lastModified)) {
      throw new Error(`Invalid sitemap lastmod date for ${entry.path}: ${entry.lastModified}`);
    }

    const location = `${SITE_ORIGIN}${entry.path}`;
    const imageLocation = `${SITE_ORIGIN}${seoSitemapImagePath(entry)}`;
    return [
      '  <url>',
      `    <loc>${escapeXml(location)}</loc>`,
      `    <lastmod>${entry.lastModified}</lastmod>`,
      '    <image:image>',
      `      <image:loc>${escapeXml(imageLocation)}</image:loc>`,
      '    </image:image>',
      '  </url>',
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
};

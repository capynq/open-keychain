import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEO_PAGE_MANIFEST, SEO_TEMPLATE_CATALOG } from '../src/infrastructure/seo/catalog';

const SITE_URL = 'https://open-keychain.com';
const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(ROOT_DIR, '../dist');

const fail = (message: string): never => {
  throw new Error(`SEO build validation failed: ${message}`);
};

const read = (relativePath: string): string => {
  const filePath = path.join(DIST_DIR, relativePath);
  if (!fs.existsSync(filePath)) fail(`missing ${relativePath}`);
  return fs.readFileSync(filePath, 'utf8');
};

type JsonLdNode = {
  '@type'?: string | string[];
  itemListElement?: Array<{ position?: number; item?: string }>;
};

const readJsonLdGraph = (html: string, route: string): JsonLdNode[] => {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (scripts.length !== 1) fail(`${route} must contain exactly one JSON-LD script`);
  const script = scripts[0];
  if (!script) fail(`${route} must contain JSON-LD content`);
  let parsed: { '@graph'?: JsonLdNode[] } | undefined;
  try {
    parsed = JSON.parse(script[1]) as { '@graph'?: JsonLdNode[] };
  } catch {
    fail(`${route} JSON-LD is not valid JSON`);
  }
  const graph = parsed?.['@graph'];
  if (!Array.isArray(graph)) fail(`${route} JSON-LD has no graph`);
  return graph as JsonLdNode[];
};

const main = (): void => {
  if (!fs.existsSync(DIST_DIR)) fail('missing dist directory');

  const favicon = path.join(DIST_DIR, 'brand/favicon-96.png');
  if (!fs.existsSync(favicon)) fail('missing 96px raster favicon');
  const privacy = read('privacy.html');
  if (!privacy.includes('meta name="robots" content="noindex,follow"'))
    fail('privacy page is indexable');

  const sitemap = read('sitemap.xml');
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const sitemapLastModified = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(
    (match) => match[1],
  );
  const sitemapImages = [...sitemap.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map(
    (match) => match[1],
  );
  const expectedUrls = SEO_PAGE_MANIFEST.map((entry) => `${SITE_URL}${entry.path}`);
  if (
    sitemapUrls.length !== expectedUrls.length ||
    expectedUrls.some((url) => !sitemapUrls.includes(url))
  ) {
    fail('sitemap does not exactly match the SEO route manifest');
  }
  if (new Set(sitemapUrls).size !== sitemapUrls.length) fail('sitemap contains duplicate URLs');
  const expectedLastModified = SEO_PAGE_MANIFEST.map((entry) => entry.lastModified);
  if (
    sitemapLastModified.length !== expectedLastModified.length ||
    expectedLastModified.some((date, index) => sitemapLastModified[index] !== date) ||
    sitemapLastModified.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date))
  ) {
    fail('sitemap lastmod values do not match the page manifest');
  }
  if (sitemapImages.length !== SEO_PAGE_MANIFEST.length)
    fail('sitemap image locations do not match the page manifest');
  for (const imageUrl of sitemapImages) {
    if (!imageUrl.startsWith(`${SITE_URL}/`)) fail(`invalid sitemap image URL: ${imageUrl}`);
    const imagePath = path.join(DIST_DIR, imageUrl.slice(`${SITE_URL}/`.length));
    if (!fs.existsSync(imagePath)) fail(`missing sitemap image asset: ${imageUrl}`);
  }

  for (const entry of SEO_PAGE_MANIFEST) {
    const relativePath = entry.path === '/' ? 'index.html' : `${entry.path.slice(1)}index.html`;
    const html = read(relativePath);
    if (!new RegExp(`<html[^>]+lang="${entry.locale}"`).test(html))
      fail(`${entry.path} has the wrong language`);
    if (!html.includes(`<link rel="canonical" href="${SITE_URL}${entry.path}"`))
      fail(`${entry.path} has no self-canonical`);
    if (!/<title>[^<]+<\/title>/.test(html)) fail(`${entry.path} has no title`);
    if (!/<h1[^>]*>[^<]+<\/h1>/.test(html)) fail(`${entry.path} has no visible H1`);
    if (!html.includes('meta name="robots" content="index,follow"'))
      fail(`${entry.path} is not indexable`);
    if (!html.includes('href="/brand/favicon-96.png"'))
      fail(`${entry.path} has no square raster favicon`);
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? '';
    if (title.length > 60) fail(`${entry.path} title is not concise (${title.length})`);
    if (!title.startsWith('Open Keychain 3D | ')) fail(`${entry.path} title is not brand-first`);
    if (entry.kind === 'guide') {
      const creatorLinks = html.match(/href="\/create\?/g) ?? [];
      if (creatorLinks.length !== 1)
        fail(`${entry.path} must have exactly one creator CTA (found ${creatorLinks.length})`);
      const sourceLinks = html.match(/href="https:\/\/github\.com\/capynq\/open-keychain"/g) ?? [];
      if (sourceLinks.length !== 1)
        fail(
          `${entry.path} must have exactly one GitHub source link (found ${sourceLinks.length})`,
        );
    }
    for (const locale of ['en', 'ru', 'uk', 'x-default']) {
      if (!html.includes(`hreflang="${locale}"`)) fail(`${entry.path} misses ${locale} alternate`);
    }
    const graph = readJsonLdGraph(html, entry.path);
    const types = graph.flatMap((node) =>
      Array.isArray(node['@type']) ? node['@type'] : node['@type'] ? [node['@type']] : [],
    );
    const requiredTypes =
      entry.kind === 'guide'
        ? ['Organization', 'WebSite', 'WebPage', 'WebApplication', 'Article', 'BreadcrumbList']
        : entry.kind === 'home' || entry.kind === 'template'
          ? ['Organization', 'WebSite', 'WebApplication', 'WebPage', 'BreadcrumbList']
          : ['Organization', 'WebSite', 'WebPage', 'BreadcrumbList'];
    for (const type of requiredTypes) {
      if (!types.includes(type)) fail(`${entry.path} has no ${type} structured data`);
    }
    if (entry.kind !== 'guide' && types.includes('Article'))
      fail(`${entry.path} unexpectedly has Article structured data`);
    const breadcrumb = graph.find((node) => node['@type'] === 'BreadcrumbList');
    if (!breadcrumb || !Array.isArray(breadcrumb.itemListElement))
      fail(`${entry.path} has no valid BreadcrumbList`);
    const breadcrumbItems = breadcrumb?.itemListElement ?? [];
    const expectedBreadcrumb =
      entry.kind === 'home'
        ? [entry.path]
        : entry.kind === 'templates'
          ? [`${entry.locale === 'en' ? '' : `/${entry.locale}`}/`, `${entry.path}`]
          : entry.kind === 'guides'
            ? [`${entry.locale === 'en' ? '' : `/${entry.locale}`}/`, `${entry.path}`]
            : entry.kind === 'template'
              ? [
                  `${entry.locale === 'en' ? '' : `/${entry.locale}`}/`,
                  `${entry.locale === 'en' ? '' : `/${entry.locale}`}/templates/`,
                  entry.path,
                ]
              : [
                  `${entry.locale === 'en' ? '' : `/${entry.locale}`}/`,
                  `${entry.locale === 'en' ? '' : `/${entry.locale}`}/guides/`,
                  entry.path,
                ];
    if (
      breadcrumbItems.length !== expectedBreadcrumb.length ||
      expectedBreadcrumb.some(
        (breadcrumbPath, index) =>
          breadcrumbItems[index]?.position !== index + 1 ||
          breadcrumbItems[index]?.item !== `${SITE_URL}${breadcrumbPath}`,
      )
    ) {
      fail(`${entry.path} BreadcrumbList has the wrong URL/order`);
    }
  }

  for (const template of SEO_TEMPLATE_CATALOG) {
    const imagePath = path.join(DIST_DIR, template.previewSrc.slice(1));
    if (!fs.existsSync(imagePath)) fail(`missing preview asset ${template.previewSrc}`);
  }

  for (const [route, expectedTitle, canonicalPath] of [
    ['create/index.html', 'Open Keychain 3D | Create a printable keychain', '/create'],
    ['profile/index.html', 'Open Keychain 3D | Your projects', '/profile'],
  ] as const) {
    const html = read(route);
    if (!html.includes('meta name="robots" content="noindex,follow"'))
      fail(`${route} is indexable`);
    if (!html.includes(expectedTitle)) fail(`${route} has an unexpected title`);
    if (!html.includes(`<link rel="canonical" href="${SITE_URL}${canonicalPath}"`))
      fail(`${route} has an unexpected canonical`);
  }

  const notFound = read('404.html');
  if (!notFound.includes('meta name="robots" content="noindex,follow"'))
    fail('404 page is indexable');
  console.log(
    `Validated ${SEO_PAGE_MANIFEST.length} SEO pages, app shells, sitemap, and 404 page.`,
  );
};

main();

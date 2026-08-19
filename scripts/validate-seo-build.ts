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

const main = (): void => {
  if (!fs.existsSync(DIST_DIR)) fail('missing dist directory');

  const sitemap = read('sitemap.xml');
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const expectedUrls = SEO_PAGE_MANIFEST.map((entry) => `${SITE_URL}${entry.path}`);
  if (
    sitemapUrls.length !== expectedUrls.length ||
    expectedUrls.some((url) => !sitemapUrls.includes(url))
  ) {
    fail('sitemap does not exactly match the SEO route manifest');
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
    for (const locale of ['en', 'ru', 'uk', 'x-default']) {
      if (!html.includes(`hreflang="${locale}"`)) fail(`${entry.path} misses ${locale} alternate`);
    }
  }

  for (const template of SEO_TEMPLATE_CATALOG) {
    const imagePath = path.join(DIST_DIR, template.previewSrc.slice(1));
    if (!fs.existsSync(imagePath)) fail(`missing preview asset ${template.previewSrc}`);
  }

  for (const [route, expectedTitle, canonicalPath] of [
    ['create/index.html', 'Create a printable keychain', '/create'],
    ['profile/index.html', 'Your projects', '/profile'],
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

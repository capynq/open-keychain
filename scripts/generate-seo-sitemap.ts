import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSeoSitemapXml } from '../src/infrastructure/seo/sitemap';

const sitemapPath = fileURLToPath(new URL('../public/sitemap.xml', import.meta.url));
const expected = buildSeoSitemapXml();

if (process.argv.includes('--check')) {
  const current = await readFile(sitemapPath, 'utf8').catch(() => '');
  if (current !== expected) {
    console.error('public/sitemap.xml is out of date. Run `pnpm seo:sitemap` to regenerate it.');
    process.exitCode = 1;
  }
} else {
  await writeFile(resolve(sitemapPath), expected, 'utf8');
}

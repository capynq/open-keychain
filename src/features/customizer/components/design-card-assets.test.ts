import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
  designCardImageSources,
  STYLE_PREVIEW_ASSETS,
  TEMPLATE_PREVIEW_ASSETS,
} from './design-card-assets';

const publicFile = (path: string) =>
  fileURLToPath(new URL(`../../../../public${path}`, import.meta.url));
const templates = Object.keys(TEMPLATE_PREVIEW_ASSETS) as (keyof typeof TEMPLATE_PREVIEW_ASSETS)[];
const urlsFor = (templateId: (typeof templates)[number]) => [
  TEMPLATE_PREVIEW_ASSETS[templateId],
  ...Object.values(STYLE_PREVIEW_ASSETS[templateId] ?? {}),
];

describe('design card images', () => {
  it('ship AVIF and WebP derivatives at every card width', async () => {
    const urls = new Set(templates.flatMap(urlsFor));
    for (const url of urls) {
      const sources = designCardImageSources(url);
      expect(sources, url).toBeDefined();
      for (const entry of [...sources!.avif.split(', '), ...sources!.webp.split(', ')]) {
        const [path, descriptor] = entry.split(' ');
        const metadata = await sharp(publicFile(path)).metadata();
        expect(`${metadata.width}w`, path).toBe(descriptor);
      }
    }
  });

  it('use one URL for identical renders within a template, so switching styles reuses them', () => {
    for (const templateId of templates) {
      const byHash = new Map<string, string>();
      for (const url of new Set(urlsFor(templateId))) {
        const hash = createHash('sha256')
          .update(readFileSync(publicFile(url)))
          .digest('hex');
        expect(byHash.get(hash), `${url} duplicates ${byHash.get(hash)}`).toBeUndefined();
        byHash.set(hash, url);
      }
    }
  });
});

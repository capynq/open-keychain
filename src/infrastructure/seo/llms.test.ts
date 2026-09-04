import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { SEO_GUIDE_CATALOG, SEO_TEMPLATE_CATALOG, seoGuidePath, seoTemplatePath } from './catalog';

const llmsText = readFileSync(new URL('../../../public/llms.txt', import.meta.url), 'utf8');
const headersText = readFileSync(new URL('../../../public/_headers', import.meta.url), 'utf8');

const linkedUrls = (): string[] =>
  [...llmsText.matchAll(/\]\((https:\/\/open-keychain\.com\/[^)]+)\)/g)].map(([, url]) => url);

describe('llms.txt contract', () => {
  it('follows the v2 heading, summary, and linked-section shape', () => {
    const lines = llmsText.split(/\r?\n/);
    expect(lines.find((line) => line.trim())).toBe('# Open Keychain 3D');
    expect(lines.some((line) => line.startsWith('> '))).toBe(true);
    const headings = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => /^## /.test(line));
    expect(headings.map(({ line }) => line)).toEqual([
      '## Product',
      '## Templates',
      '## Guides',
      '## Optional',
    ]);
    for (const [position, heading] of headings.entries()) {
      const end = headings[position + 1]?.index ?? lines.length;
      const sectionLines = lines.slice(heading.index + 1, end).filter((line) => line.trim());
      expect(sectionLines.length).toBeGreaterThan(0);
      expect(sectionLines.every((line) => /^- \[[^\]]+\]\([^)]+\)/.test(line))).toBe(true);
      expect(sectionLines.some((line) => /^- https?:\/\//.test(line))).toBe(false);
    }
  });

  it('contains unique, parseable first-party links', () => {
    const urls = linkedUrls();

    expect(urls.length).toBeGreaterThan(0);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((url) => new URL(url).hostname === 'open-keychain.com')).toBe(true);
  });

  it('keeps the machine-readable resource index aligned with the SEO catalog', () => {
    const urls = new Set(linkedUrls());

    expect(urls).toContain('https://open-keychain.com/templates/');
    expect(urls).toContain('https://open-keychain.com/guides/');
    expect(urls).toContain('https://open-keychain.com/create');
    expect(urls).toContain('https://open-keychain.com/privacy');

    for (const template of SEO_TEMPLATE_CATALOG) {
      expect(urls).toContain(`https://open-keychain.com${seoTemplatePath('en', template)}`);
    }
    for (const guide of SEO_GUIDE_CATALOG) {
      expect(urls).toContain(`https://open-keychain.com${seoGuidePath('en', guide)}`);
    }
  });

  it('publishes the Markdown and WebMCP security headers', () => {
    expect(headersText).toContain('Content-Type: text/markdown; charset=UTF-8');
    expect(headersText).toContain(
      'Permissions-Policy: camera=(), microphone=(), geolocation=(), tools=(self)',
    );
    expect(headersText).toContain('Origin-Agent-Cluster: ?1');
  });
});

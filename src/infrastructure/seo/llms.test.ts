import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { SEO_GUIDE_CATALOG, SEO_TEMPLATE_CATALOG, seoGuidePath, seoTemplatePath } from './catalog';

const llmsText = readFileSync(new URL('../../../public/llms.txt', import.meta.url), 'utf8');
const robotsText = readFileSync(new URL('../../../public/robots.txt', import.meta.url), 'utf8');
const aiCatalog = JSON.parse(
  readFileSync(new URL('../../../public/ai-catalog.json', import.meta.url), 'utf8'),
) as {
  specVersion?: unknown;
  host?: Record<string, unknown>;
  entries?: Array<Record<string, unknown>>;
};
const headersText = readFileSync(new URL('../../../public/_headers', import.meta.url), 'utf8');

const linkedUrls = (): string[] =>
  [...llmsText.matchAll(/\]\((https:\/\/open-keychain\.com\/[^)]+)\)/g)].map(([, url]) => url);

describe('llms.txt contract', () => {
  it('keeps robots directives recognized and uses HTTP discovery for llms.txt', () => {
    const directives = robotsText
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.split(':', 1)[0]);

    expect(directives).toEqual(['User-agent', 'Allow', 'Sitemap']);
    expect(robotsText).not.toMatch(/^LLMs:/m);
  });

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

  it('publishes the Markdown, catalog, and WebMCP security headers', () => {
    expect(headersText).toContain('Content-Type: text/markdown; charset=UTF-8');
    expect(headersText).toContain('Content-Type: application/json; charset=UTF-8');
    expect(headersText).toContain('Cache-Control: public, max-age=3600, must-revalidate');
    expect(headersText).toContain(
      'Link: </llms.txt>; rel="describedby"; type="text/markdown", </ai-catalog.json>; rel="ai-catalog"; type="application/json"',
    );
    expect(headersText).toContain('/fonts/*\n  Cache-Control: public, max-age=31536000, immutable');
    expect(headersText).toContain(
      '/showcase/v1/*\n  Cache-Control: public, max-age=31536000, immutable',
    );
    expect(headersText).toContain(
      '/manifold-v1.wasm\n  Content-Type: application/wasm\n  Cache-Control: public, max-age=31536000, immutable',
    );
    expect(headersText).toContain(
      'Permissions-Policy: camera=(), microphone=(), geolocation=(), tools=(self)',
    );
    expect(headersText).toContain('Origin-Agent-Cluster: ?1');
  });

  it('publishes a valid ARD ai-catalog shape for the browser customizer', () => {
    expect(Object.keys(aiCatalog).sort()).toEqual(['entries', 'host', 'specVersion']);
    expect(aiCatalog.specVersion).toBe('1.0');
    expect(aiCatalog.host).toMatchObject({ displayName: 'Open Keychain 3D' });
    expect(aiCatalog.entries).toHaveLength(1);
    expect(aiCatalog.entries?.[0]).toMatchObject({
      identifier: 'urn:air:open-keychain:browser:webmcp-customizer',
      displayName: 'Open Keychain browser customizer',
      type: 'text/html',
      url: 'https://open-keychain.com/create',
      capabilities: ['get-keychain-state', 'customize-keychain'],
    });
  });
});

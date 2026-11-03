import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = fileURLToPath(new URL('./check-sourcemaps.mjs', import.meta.url));
const tempDirs = [];

const entryJs = 'console.log("app");\n//# chunkId=app-chunk\n';
const vendorJs = 'export const value = 1;\n//# chunkId=vendor-chunk\n';
const validMap = JSON.stringify({ version: 3, sources: ['../src/main.ts'], mappings: '' });
const indexHtml = (src) =>
  `<!doctype html><html><head><script type="module" crossorigin src="${src}"></script></head><body></body></html>`;

const validDist = () => ({
  'index.html': indexHtml('/assets/app-abc123.js'),
  'assets/app-abc123.js': entryJs,
  'assets/app-abc123.js.map': validMap,
  'assets/vendor-def456.js': vendorJs,
  'assets/vendor-def456.js.map': validMap,
});

const makeDist = (files) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'check-sourcemaps-'));
  tempDirs.push(dir);
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(dir, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  return dir;
};

const runCheck = (dir) => spawnSync(process.execPath, [scriptPath, dir], { encoding: 'utf8' });

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe('check-sourcemaps', () => {
  it('passes for a bundle with entry, chunk markers, and non-empty source maps', () => {
    const result = runCheck(makeDist(validDist()));
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('verified 2 JavaScript file(s)');
  });

  it('fails when a JavaScript file has no sibling source map', () => {
    const files = validDist();
    const dir = makeDist(files);
    unlinkSync(path.join(dir, 'assets/vendor-def456.js.map'));
    const result = runCheck(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('vendor-def456.js has no sibling source map');
  });

  it('fails when the entry source map is missing', () => {
    const dir = makeDist(validDist());
    unlinkSync(path.join(dir, 'assets/app-abc123.js.map'));
    const result = runCheck(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('has no source map');
  });

  it('fails when a JavaScript file lacks the PostHog chunkId marker', () => {
    const files = validDist();
    files['assets/vendor-def456.js'] = 'export const value = 1;\n';
    const result = runCheck(makeDist(files));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('vendor-def456.js is missing the PostHog chunk marker');
  });

  it('fails for an empty dist without JavaScript files', () => {
    const result = runCheck(makeDist({}));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no JavaScript files found');
  });

  it('fails when index.html has no module script entry', () => {
    const files = validDist();
    files['index.html'] = '<!doctype html><html><body><script>window.x = 1;</script></body></html>';
    const result = runCheck(makeDist(files));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('index.html has no <script type="module" src> entry');
  });

  it('fails when the index.html entry script is not present in dist', () => {
    const files = validDist();
    files['index.html'] = indexHtml('/assets/app-missing.js');
    const result = runCheck(makeDist(files));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'entry script "/assets/app-missing.js" referenced by index.html was not found',
    );
  });

  it('exempts an unmapped CSS-only JavaScript stub', () => {
    const files = validDist();
    files['assets/customizerBootStyles-ijadQVeA.js'] = '/* empty css                */';
    const result = runCheck(makeDist(files));
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('exempted 1 CSS-only JavaScript stub(s)');
  });

  it('fails when an unmapped JavaScript file contains real code', () => {
    const files = validDist();
    files['assets/orphan-ghi789.js'] = 'export const orphan = 2;\n//# chunkId=orphan\n';
    const result = runCheck(makeDist(files));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('orphan-ghi789.js has no sibling source map');
  });

  it('fails when a stub-looking file has code after its comment', () => {
    const files = validDist();
    files['assets/fake-stub-jkl012.js'] = '/* empty css */\nconsole.log("not css");';
    const result = runCheck(makeDist(files));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('fake-stub-jkl012.js has no sibling source map');
  });

  it('never exempts the HTML entry script even when it looks like a stub', () => {
    const files = validDist();
    delete files['assets/app-abc123.js.map'];
    files['assets/app-abc123.js'] = '/* empty css                */';
    const result = runCheck(makeDist(files));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/entry script \S*app-abc123\.js has no source map/);
  });

  it('fails when a source map has an empty sources list', () => {
    const files = validDist();
    files['assets/vendor-def456.js.map'] = JSON.stringify({
      version: 3,
      sources: [],
      mappings: '',
    });
    const result = runCheck(makeDist(files));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('has an empty "sources" list');
  });
});

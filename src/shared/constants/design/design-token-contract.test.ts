import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourceRoot = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)), 'src');

const cssFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) return cssFiles(entryPath);

    return entry.isFile() && entry.name.endsWith('.css') ? [entryPath] : [];
  });

const workshopPalette = readFileSync(
  path.join(sourceRoot, 'shared/constants/design/palette.css'),
  'utf8',
);
const workshopTokens = (): Map<string, string> =>
  new Map(
    [...workshopPalette.matchAll(/(--workshop-[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [
      match[1],
      match[2].trim(),
    ]),
  );

const luminance = (color: string): number => {
  const channels = color.match(/[\da-f]{2}/gi)?.map((channel) => parseInt(channel, 16) / 255);

  if (!channels || channels.length !== 3) throw new Error(`Unsupported palette color: ${color}`);

  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
};

const contrastRatio = (foreground: string, background: string): number => {
  const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);

  return (values[0] + 0.05) / (values[1] + 0.05);
};

describe('Workshop design token contract', () => {
  it('defines every Workshop token referenced by application CSS', () => {
    const files = cssFiles(sourceRoot);
    const definitions = new Set<string>();
    const references = new Set<string>();

    for (const file of files) {
      const css = readFileSync(file, 'utf8');

      for (const [, token] of css.matchAll(/(--workshop-[\w-]+)\s*:/g)) definitions.add(token);

      for (const [, token] of css.matchAll(/var\(\s*(--workshop-[\w-]+)/g)) references.add(token);
    }

    expect([...references].filter((token) => !definitions.has(token)).sort()).toEqual([]);
  });

  it('keeps Workshop toolbar text readable at rest and on the selected surface', () => {
    const tokens = workshopTokens();
    const foreground = tokens.get('--workshop-text-on-dark');
    const resting = tokens.get('--workshop-surface-dark');
    const selectedText = tokens.get('--workshop-accent-strong');
    const selectedSurface = tokens.get('--workshop-surface');

    expect(foreground).toBeDefined();
    expect(resting).toBeDefined();
    expect(selectedText).toBeDefined();
    expect(selectedSurface).toBeDefined();
    expect(contrastRatio(foreground!, resting!)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(selectedText!, selectedSurface!)).toBeGreaterThanOrEqual(4.5);
  });
  it('keeps keyboard focus distinct on Workshop surfaces and recovery feedback', () => {
    const tokens = workshopTokens();
    const focusToken = tokens
      .get('--workshop-focus-ring')
      ?.match(/var\((--workshop-[\w-]+)\)/)?.[1];
    expect(focusToken).toBeDefined();
    const color = tokens.get(focusToken!)!;

    for (const surface of [
      '--workshop-surface',
      '--workshop-surface-control',
      '--workshop-selected-surface',
    ]) {
      expect(contrastRatio(color, tokens.get(surface)!)).toBeGreaterThanOrEqual(3);
    }

    expect(contrastRatio(color, '#fbe0cd')).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(tokens.get('--workshop-text')!, '#fbe0cd')).toBeGreaterThanOrEqual(4.5);
  });
});

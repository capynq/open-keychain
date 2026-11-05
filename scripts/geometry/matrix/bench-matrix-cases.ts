import type { KeychainParams, TemplateId } from '../../../src/domain/keychain/model/types';

import {
  FONT_CATALOG,
  fontSupportsArticulatedName,
  fontSupportsText,
} from '../../../src/domain/keychain/fonts/catalog';
import { TEMPLATE_CATALOG } from '../../../src/domain/keychain/templates/template-builder';

export const MATRIX_TEXTS = [
  { value: 'A', className: 'short' },
  { value: 'ALEX', className: 'standard-latin' },
  { value: 'MAXIMILIAN', className: 'long-latin' },
  { value: 'IIIIIIII', className: 'narrow-glyphs' },
  { value: 'WWWWWWWW', className: 'wide-glyphs' },
  { value: 'iJj', className: 'mixed-case' },
  { value: 'ÉMILIE', className: 'accented-latin' },
  { value: 'НИКИТА', className: 'standard-cyrillic' },
  { value: 'ВЛАДИСЛАВА', className: 'long-cyrillic' },
  { value: 'Привет', className: 'mixed-case-cyrillic' },
] as const;

export type MatrixCase = {
  id: string;
  templateId: TemplateId;
  styleId: KeychainParams['styleId'];
  fontId: string;
  text: (typeof MATRIX_TEXTS)[number];
};

const stableHash = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

export const listMatrixCases = (): MatrixCase[] => {
  const cases: MatrixCase[] = [];
  for (const template of TEMPLATE_CATALOG) {
    const styles = template.styles.length
      ? template.styles
      : (['contour'] as const satisfies readonly KeychainParams['styleId'][]);
    for (const font of FONT_CATALOG) {
      for (const text of MATRIX_TEXTS) {
        const supported =
          template.id === 'articulated-name'
            ? fontSupportsArticulatedName(font, text.value)
            : fontSupportsText(font, text.value);
        if (!supported) continue;
        for (const styleId of styles) {
          const id = `${template.id}/${styleId}/${font.id}/${text.className}`;
          cases.push({ id, templateId: template.id, styleId, fontId: font.id, text });
        }
      }
    }
  }
  return cases;
};

export const partitionMatrixCases = (cases: MatrixCase[], packageSize: number) => {
  if (!Number.isInteger(packageSize) || packageSize < 1)
    throw new Error('Matrix package size must be a positive integer.');
  const packages: Array<{ packageId: number; cases: MatrixCase[] }> = [];
  for (let start = 0; start < cases.length; start += packageSize)
    packages.push({ packageId: packages.length, cases: cases.slice(start, start + packageSize) });
  return packages;
};

export const partitionMatrixCasesByShard = (
  cases: MatrixCase[],
  shardIndex: number,
  shardCount: number,
): MatrixCase[] => {
  if (
    !Number.isInteger(shardCount) ||
    shardCount < 1 ||
    shardCount > 12 ||
    !Number.isInteger(shardIndex) ||
    shardIndex < 0 ||
    shardIndex >= shardCount
  )
    throw new Error('Matrix shard index/count must identify one shard from 0 to 11 of 1 to 12.');

  const byTemplate = new Map<TemplateId, MatrixCase[]>();
  for (const item of cases) {
    const templateCases = byTemplate.get(item.templateId) ?? [];
    templateCases.push(item);
    byTemplate.set(item.templateId, templateCases);
  }
  const selected: MatrixCase[] = [];
  for (const templateCases of byTemplate.values()) {
    const ordered = [...templateCases].sort(
      (left, right) =>
        stableHash(left.id) - stableHash(right.id) || left.id.localeCompare(right.id),
    );
    for (let index = shardIndex; index < ordered.length; index += shardCount)
      selected.push(ordered[index]);
  }
  return selected;
};

export const selectMatrixBenchmarkSample = (
  cases: MatrixCase[],
  sampleSize: number,
): MatrixCase[] => {
  if (!Number.isInteger(sampleSize) || sampleSize < 1 || sampleSize > cases.length)
    throw new Error(`Matrix benchmark sample must be from 1 to ${cases.length}.`);

  const byTemplate = new Map<TemplateId, MatrixCase[]>();
  for (const item of cases) {
    const group = byTemplate.get(item.templateId) ?? [];
    group.push(item);
    byTemplate.set(item.templateId, group);
  }
  if (sampleSize < byTemplate.size)
    throw new Error(`Matrix benchmark sample must include at least ${byTemplate.size} cases.`);

  const remaining = sampleSize - byTemplate.size;
  const quotas = [...byTemplate.entries()].map(([templateId, items]) => {
    const exact = (items.length / cases.length) * remaining;
    return {
      templateId,
      items,
      remainder: exact - Math.floor(exact),
      quota: 1 + Math.floor(exact),
    };
  });
  let unassigned = sampleSize - quotas.reduce((total, item) => total + item.quota, 0);
  for (const item of quotas
    .slice()
    .sort(
      (left, right) => right.remainder - left.remainder || right.items.length - left.items.length,
    )) {
    if (unassigned <= 0) break;
    item.quota += 1;
    unassigned -= 1;
  }
  if (unassigned) throw new Error('Unable to allocate the requested stratified matrix sample.');

  return quotas.flatMap(({ items, quota }) =>
    [...items]
      .sort(
        (left, right) =>
          stableHash(left.id) - stableHash(right.id) || left.id.localeCompare(right.id),
      )
      .slice(0, quota),
  );
};

export type MatrixCaseDurations = Readonly<Record<string, number>>;

/* Contiguous packages; font cache holds 16 entries */
export const scheduleMatrixPackages = (
  cases: MatrixCase[],
  packageSize: number,
  history: MatrixCaseDurations = {},
  splitShare = 0.05,
) => {
  const known = Object.values(history).filter((value) => Number.isFinite(value) && value > 0);
  const average = known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : 0;
  const cost = (item: MatrixCase) =>
    Number.isFinite(history[item.id]) && history[item.id] > 0
      ? history[item.id]
      : average || item.text.value.length;
  const chunks = partitionMatrixCases(cases, packageSize)
    .map(({ cases: items }) => ({
      items,
      cost: items.reduce((sum, item) => sum + cost(item), 0),
    }))
    .sort(
      (left, right) => right.cost - left.cost || left.items[0].id.localeCompare(right.items[0].id),
    );
  const splitCount = Math.min(chunks.length, Math.ceil(chunks.length * splitShare));
  const singles = chunks
    .slice(0, splitCount)
    .flatMap(({ items }) => items)
    .sort((left, right) => cost(right) - cost(left) || left.id.localeCompare(right.id))
    .map((item) => [item]);
  return [...singles, ...chunks.slice(splitCount).map(({ items }) => items)].map(
    (items, packageId) => ({ packageId, cases: items }),
  );
};

export const findMatrixSlowdowns = (
  durations: MatrixCaseDurations,
  history: MatrixCaseDurations,
  { factor = 3, minimumMs = 5000, limit = 10 } = {},
) =>
  Object.entries(durations)
    .filter(([id, durationMs]) => {
      const previous = history[id];
      return (
        Number.isFinite(previous) &&
        previous > 0 &&
        durationMs >= minimumMs &&
        durationMs > previous * factor
      );
    })
    .map(([id, durationMs]) => ({
      case: id,
      durationMs: Math.round(durationMs),
      previousMs: Math.round(history[id]),
    }))
    .sort((left, right) => right.durationMs / right.previousMs - left.durationMs / left.previousMs)
    .slice(0, limit);

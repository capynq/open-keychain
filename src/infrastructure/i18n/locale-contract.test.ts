import { describe, expect, it } from 'vitest';

import en from './locales/en.json';
import ru from './locales/ru.json';
import uk from './locales/uk.json';

const leafPaths = (value: unknown, prefix = ''): string[] => {
  if (typeof value !== 'object' || value === null) return [prefix];

  return Object.entries(value).flatMap(([key, child]) =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key),
  );
};

describe('translation resource contract', () => {
  it('keeps English, Russian, and Ukrainian translation keys aligned', () => {
    const englishKeys = leafPaths(en).sort();

    expect(leafPaths(ru).sort()).toEqual(englishKeys);
    expect(leafPaths(uk).sort()).toEqual(englishKeys);
  });
});

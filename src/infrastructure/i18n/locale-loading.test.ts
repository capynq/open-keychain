import { describe, expect, it, vi } from 'vitest';

import i18n, { isLocaleLoaded, loadLocale, localeSettled, subscribeLocaleLoads } from './config';

const NAMESPACES = ['translation', 'styles', 'templates'];

describe('loadLocale', () => {
  it('ships English with the entry', async () => {
    expect(isLocaleLoaded('en')).toBe(true);
    await expect(loadLocale('en')).resolves.toBeUndefined();
  });

  it('loads every namespace of a locale once, then notifies subscribers', async () => {
    for (const namespace of NAMESPACES) i18n.removeResourceBundle('uk', namespace);
    expect(isLocaleLoaded('uk')).toBe(false);
    const listener = vi.fn();
    const unsubscribe = subscribeLocaleLoads(listener);

    const first = loadLocale('uk');
    expect(loadLocale('uk')).toBe(first);
    await first;
    unsubscribe();

    expect(isLocaleLoaded('uk')).toBe(true);
    for (const namespace of NAMESPACES) expect(i18n.hasResourceBundle('uk', namespace)).toBe(true);
    expect(i18n.getFixedT('uk')('language')).not.toBe(i18n.getFixedT('en')('language'));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('gives React one settled promise per locale', async () => {
    expect(localeSettled('ru')).toBe(localeSettled('ru'));
    await expect(localeSettled('ru')).resolves.toBeUndefined();
  });
});

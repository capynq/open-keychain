import { describe, expect, it } from 'vitest';
import { appSeoCanonical, resolveAppSeoUrl } from './app-metadata';

describe('customizer SEO URL resolver', () => {
  it('accepts only localized bare and template URLs', () => {
    expect(resolveAppSeoUrl('/create', '?lang=ru')).toEqual({ indexable: true, locale: 'ru' });
    expect(resolveAppSeoUrl('/create', '?template=plant-label&lang=uk')).toEqual({
      indexable: true,
      locale: 'uk',
      template: 'plant-label',
    });
    expect(resolveAppSeoUrl('/create', '')).toMatchObject({ indexable: false });
    expect(resolveAppSeoUrl('/create', '?lang=en&design=bad')).toMatchObject({ indexable: false });
    expect(resolveAppSeoUrl('/create', '?template=magnet&lang=en')).toMatchObject({
      indexable: false,
    });
  });

  it('keeps non-normalized variants out of the index', () => {
    expect(appSeoCanonical('/create', '?lang=uk&template=nameplate')).toBe(
      'https://open-keychain.com/create?lang=uk&template=nameplate',
    );
    expect(resolveAppSeoUrl('/create', '?lang=uk&template=nameplate')).toMatchObject({
      indexable: false,
    });
  });
});

import { describe, expect, it } from 'vitest';

import { resolveDisplayLocale } from './routes';

describe('SEO locale precedence', () => {
  it('prefers a localized route over a conflicting lang query', () => {
    expect(resolveDisplayLocale({ pathname: '/ru/guides/', search: '?lang=uk' }, 'en')).toBe('ru');
    expect(resolveDisplayLocale({ pathname: '/uk/', search: '?lang=ru' }, 'en')).toBe('uk');
  });

  it('keeps query locale behavior for the generic root and customizer paths', () => {
    expect(resolveDisplayLocale({ pathname: '/', search: '?lang=ru' }, 'en')).toBe('ru');
    expect(resolveDisplayLocale({ pathname: '/', search: '' }, 'uk')).toBe('uk');
    expect(resolveDisplayLocale({ pathname: '/create', search: '?lang=uk' }, 'en')).toBe('uk');
    expect(resolveDisplayLocale({ pathname: '/privacy', search: '?lang=ru' }, 'en')).toBe('ru');
  });
});

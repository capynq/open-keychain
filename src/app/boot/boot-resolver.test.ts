import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { detectInitialLocale } from '@/features/seo';
import { SEO_PAGE_MANIFEST } from '@/infrastructure/seo/catalog';

/*
 * The inline resolver in index.html picks the boot frame and the locale chunk to preload before
 * any module runs; it has to agree with the locale the app's first render uses.
 */
const runResolver = (source: string, { url = '/', languages = ['en-US'] } = {}) => {
  const { pathname, search } = new URL(url, 'https://open-keychain.com');
  const documentElement = { dataset: {} as Record<string, string>, lang: 'en' };

  new Function('window', 'document', 'navigator', source)(
    { location: { pathname, search } },
    { documentElement },
    { languages, language: languages[0] },
  );
  return documentElement.dataset;
};

describe('index.html resolver', () => {
  const resolver =
    /<script>\s*(\(\(\) => \{\s*\/\* Picks the boot frame variant[\s\S]*?)<\/script>/.exec(
      readFileSync(new URL('../../../index.html', import.meta.url), 'utf8'),
    )?.[1];

  it('picks the locale the app first renders on every SEO page', () => {
    expect(resolver).toBeDefined();
    for (const { path } of SEO_PAGE_MANIFEST) {
      for (const languages of [['en-US'], ['ru-RU'], ['uk-UA']]) {
        expect(runResolver(resolver!, { url: path, languages }).bootLocale, path).toBe(
          detectInitialLocale('', path),
        );
      }
    }
  });

  it('keeps `/` English unless `?lang` asks and follows the browser elsewhere', () => {
    expect(runResolver(resolver!, { url: '/', languages: ['ru-RU'] }).bootLocale).toBe('en');
    expect(runResolver(resolver!, { url: '/?lang=uk' }).bootLocale).toBe('uk');
    expect(runResolver(resolver!, { url: '/create', languages: ['de-DE', 'uk-UA'] })).toMatchObject(
      { bootLocale: 'uk', bootKey: 'uk:name-keychain' },
    );
    expect(runResolver(resolver!, { url: '/create?lang=ru', languages: ['uk'] }).bootLocale).toBe(
      'ru',
    );
    expect(runResolver(resolver!, { url: '/profile', languages: ['ru'] }).bootLocale).toBe('ru');
  });
});

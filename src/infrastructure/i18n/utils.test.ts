import { describe, expect, it } from 'vitest';

import { issueMessage, styleName, t } from './utils';
describe('i18n utilities', () => {
  it('translates messages with interpolation', () => {
    expect(t('en', 'warningScaled', { height: '18.0' })).toContain('18.0 mm');
    expect(t('ru', 'ready')).toContain('Готово');
  });
  it('never leaves an empty measurement in the over-width warning', () => {
    const atMinimum = issueMessage('en', {
      code: 'text-over-width',
      message:
        'This name is 207.4 mm wide even at the minimum 12 mm text height; export remains available.',
    });
    expect(atMinimum).toContain('207.4 mm wide');
    expect(atMinimum).not.toMatch(/ at mm|\s mm/);
    for (const locale of ['en', 'ru', 'uk'] as const) {
      const generic = issueMessage(locale, {
        code: 'text-over-width',
        message: 'The finished design exceeds the recommended 120 mm width.',
      });
      expect(generic).toContain('120');
      expect(generic).not.toMatch(/\s(mm|мм)\b.*\s(mm|мм)\b/);
    }
  });
  it('localizes style names and geometry issues', () => {
    expect(styleName('uk', 'arch', 'Arch')).not.toBe('Arch');
    expect(
      issueMessage('en', { code: 'missing-glyph', message: 'The font does not contain “Ж”.' }),
    ).toContain('Ж');
    expect(issueMessage('ru', { code: 'relief-outside-backing', message: '' })).toContain('основы');
    expect(
      issueMessage('ru', { code: 'subtitle-font-load', message: 'Could not load subtitle font.' }),
    ).toContain('шрифт подзаголовка');
    expect(
      issueMessage('uk', {
        code: 'subtitle-missing-glyph',
        message: 'The subtitle font does not contain “Ж”.',
      }),
    ).toContain('шрифті підзаголовка');
    expect(
      issueMessage('en', {
        code: 'text-over-width',
        message:
          'The name remains 20.0 mm high and is 146.2 mm wide; the width cap was not enforced.',
      }),
    ).toContain('20.0 mm');
    expect(
      issueMessage('en', {
        code: 'text-over-width',
        message:
          'The name remains 20.0 mm high and is 146.2 mm wide; the width cap was not enforced.',
      }),
    ).toContain('146.2 mm');
  });
});

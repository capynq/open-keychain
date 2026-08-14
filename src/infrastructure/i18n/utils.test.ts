import { describe, expect, it } from 'vitest';
import { issueMessage, styleName, t } from './utils';
describe('i18n utilities', () => {
  it('translates messages with interpolation', () => {
    expect(t('en', 'warningScaled', { height: '18.0' })).toContain('18.0 mm');
    expect(t('ru', 'ready')).toContain('Готово');
  });
  it('localizes style names and geometry issues', () => {
    expect(styleName('uk', 'arch', 'Arch')).not.toBe('Arch');
    expect(
      issueMessage('en', { code: 'missing-glyph', message: 'The font does not contain “Ж”.' }),
    ).toContain('Ж');
    expect(issueMessage('ru', { code: 'relief-outside-backing', message: '' })).toContain('основы');
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

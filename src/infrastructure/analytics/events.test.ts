import { describe, expect, it } from 'vitest';
import { sanitizeProperties } from './events';

describe('analytics event properties', () => {
  it('keeps low-cardinality scalar properties and removes undefined values', () => {
    expect(
      sanitizeProperties({ locale: 'en', template: 'name-keychain', count: 2, enabled: true }),
    ).toEqual({ locale: 'en', template: 'name-keychain', count: 2, enabled: true });
  });

  it('rejects unsafe property names', () => {
    expect(sanitizeProperties({ 'raw name': 'ALEX', 'query-string': 'secret', ok: 'yes' })).toEqual(
      {
        ok: 'yes',
      },
    );
  });
});

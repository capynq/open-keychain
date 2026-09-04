import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { createNameKeychainArchive, parseNameKeychainCsv } from './name-keychain-batch';

describe('name keychain batch CSV', () => {
  it('keeps names out of the manifest while preserving a printable order file', () => {
    const parsed = parseNameKeychainCsv('order_id,text,quantity\netsy-42,ALEX,2\n');
    const archive = createNameKeychainArchive(parsed.orders, parsed.errors, [
      { order: parsed.orders[0], data: new Uint8Array([1, 2, 3]) },
    ]);
    const files = unzipSync(archive);

    expect(Object.keys(files).sort()).toEqual(['etsy-42.stl', 'manifest.csv']);
    expect(strFromU8(files['manifest.csv'])).not.toContain('ALEX');
    expect(strFromU8(files['manifest.csv'])).toContain('etsy-42');
  });

  it('reports malformed, duplicate, and over-limit rows without accepting them', () => {
    const header = 'order_id,text,quantity';
    const rows = Array.from({ length: 26 }, (_, index) => `order-${index},ALEX,1`);
    const parsed = parseNameKeychainCsv([header, ...rows, 'order-0,MIRA,1', 'bad,,0'].join('\n'));

    expect(parsed.orders).toHaveLength(25);
    expect(parsed.errors.map((error) => error.reason)).toEqual(
      expect.arrayContaining([
        'A batch supports up to 25 rows.',
        'order_id must be unique in this batch.',
        'order_id and text are required.',
      ]),
    );
  });

  it('rejects order ids that would overwrite the same printable filename', () => {
    const parsed = parseNameKeychainCsv('order_id,text,quantity\norder/a,ALEX,1\norder?a,MIRA,1\n');

    expect(parsed.orders).toHaveLength(1);
    expect(parsed.errors).toContainEqual({
      line: 3,
      reason: 'order_id must create a unique printable filename.',
    });
  });
});

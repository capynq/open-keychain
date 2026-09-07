import { describe, expect, it } from 'vitest';

import { BoundedResultCache } from './result-cache';

describe('BoundedResultCache', () => {
  it('counts shared buffers once and evicts by byte budget', () => {
    const weight = (value: { buffers: ArrayBuffer[] }) => {
      const unique = new Set(value.buffers);
      let total = 0;
      for (const buffer of unique) total += buffer.byteLength;
      return total;
    };
    const cache = new BoundedResultCache<{ buffers: ArrayBuffer[] }>(8, 10, weight);
    const shared = new ArrayBuffer(6);
    cache.set('shared', { buffers: [shared, shared] });
    cache.set('second', { buffers: [new ArrayBuffer(6)] });

    expect(cache.get('shared')).toBeUndefined();
    expect(cache.get('second')).toBeDefined();
  });

  it('skips a single result larger than the budget', () => {
    const cache = new BoundedResultCache<{ bytes: ArrayBuffer }>(
      8,
      4,
      (value) => value.bytes.byteLength,
    );
    cache.set('large', { bytes: new ArrayBuffer(5) });
    expect(cache.get('large')).toBeUndefined();
  });
});

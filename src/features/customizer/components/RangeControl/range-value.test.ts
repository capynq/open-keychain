import { describe, expect, it } from 'vitest';

import { commitRangeValue } from './range-value';

describe('commitRangeValue', () => {
  it('ignores a cleared or invalid number field instead of jumping to the minimum', () => {
    expect(commitRangeValue('', 1.5, 8, 0.1)).toBeUndefined();
    expect(commitRangeValue('   ', 1.5, 8, 0.1)).toBeUndefined();
  });

  it('clamps typed values to the slider range and snaps to its step', () => {
    expect(commitRangeValue('3.37', 0, 5, 0.1)).toBe(3.4);
    expect(commitRangeValue('9', 0, 5, 0.1)).toBe(5);
    expect(commitRangeValue('-2', 1.5, 8, 0.1)).toBe(1.5);
    expect(commitRangeValue('12', -100, 100, 5)).toBe(10);
  });

  it('accepts a decimal comma and ignores text that is not a number', () => {
    expect(commitRangeValue('2,5', 0, 5, 0.5)).toBe(2.5);
    expect(commitRangeValue('abc', 0, 5, 0.1)).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import {
  defaultValidationConcurrency,
  maxValidationConcurrency,
  unitWorkerCount,
  validationConcurrency,
} from './concurrency.mjs';

describe('validation concurrency defaults', () => {
  it('keeps small machines at the historical min(4, cores) budget', () => {
    expect(defaultValidationConcurrency(1)).toBe(1);
    expect(defaultValidationConcurrency(2)).toBe(2);
    expect(defaultValidationConcurrency(4)).toBe(4);
    expect(defaultValidationConcurrency(6)).toBe(4);
  });

  it('leaves two cores free on larger machines and never exceeds eight', () => {
    expect(defaultValidationConcurrency(8)).toBe(6);
    expect(defaultValidationConcurrency(10)).toBe(8);
    expect(defaultValidationConcurrency(16)).toBe(8);
    expect(maxValidationConcurrency(16)).toBe(8);
  });

  it('honours explicit overrides and rejects invalid ones', () => {
    expect(validationConcurrency({ VALIDATION_CONCURRENCY: '1' })).toBe(1);
    expect(validationConcurrency({ VALIDATION_CONCURRENCY: '8' })).toBe(8);
    expect(() => validationConcurrency({ VALIDATION_CONCURRENCY: '9' })).toThrow(
      'VALIDATION_CONCURRENCY',
    );
    expect(() => validationConcurrency({ VALIDATION_CONCURRENCY: 'many' })).toThrow(
      'VALIDATION_CONCURRENCY',
    );
  });

  it('gives unit and browser gates half the budget, never fewer than two workers', () => {
    expect(unitWorkerCount({ VALIDATION_CONCURRENCY: '1' })).toBe(2);
    expect(unitWorkerCount({ VALIDATION_CONCURRENCY: '4' })).toBe(2);
    expect(unitWorkerCount({ VALIDATION_CONCURRENCY: '8' })).toBe(4);
  });
});

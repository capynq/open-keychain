import { describe, expect, it } from 'vitest';

import type { GeometryResult } from '../../../domain/keychain/model/types';

import { previewStatus } from './preview-status';

const result = (overrides: Partial<GeometryResult> = {}): GeometryResult => ({
  generationId: 1,
  baseMesh: { positions: new Float32Array(), indices: new Uint32Array() },
  reliefMesh: { positions: new Float32Array(), indices: new Uint32Array() },
  dimensions: { widthMm: 40, heightMm: 20, thicknessMm: 3, centerMm: [0, 0, 0] },
  issues: [],
  printable: true,
  appearance: {
    base: { name: 'Backing', color: '#000000' },
    relief: { name: 'Text', color: '#ffffff' },
  },
  ...overrides,
});

describe('previewStatus', () => {
  it('reports warnings as adjusted while keeping the model ready', () => {
    const status = previewStatus(
      {
        result: result({
          issues: [
            {
              severity: 'warning',
              code: 'scaled-to-fit',
              message: 'The name was adjusted to 18.0 mm high.',
            },
          ],
        }),
        busy: false,
        error: undefined,
      },
      'en',
    );

    expect(status.className).toBe('adjusted');
    expect(status.text).toContain('adjusted');
    expect(status.feedback).toContain('18.0 mm');
    expect(status.feedbackIssue?.code).toBe('scaled-to-fit');
    expect(status.fixTarget).toBe('print');
  });

  it('reports generation errors as attention required', () => {
    const status = previewStatus({ result: result(), busy: false, error: 'Worker failed.' }, 'en');

    expect(status.className).toBe('attention');
    expect(status.text).toContain('attention');
    expect(status.feedback).toBe('Worker failed.');
    expect(status.feedbackIssue).toBeUndefined();
    expect(status.fixTarget).toBe('essentials');
  });

  it('keeps generation errors visible while stale generation state is present', () => {
    const status = previewStatus(
      { result: result(), busy: true, current: false, error: 'Worker failed.' },
      'en',
    );

    expect(status.className).toBe('attention');
    expect(status.text).toContain('attention');
  });

  it('keeps fix targeting independent from localized issue text', () => {
    const status = previewStatus(
      {
        result: result({
          issues: [
            {
              severity: 'error',
              code: 'articulated-font',
              message: 'English fallback text that is not localized.',
            },
          ],
          printable: false,
        }),
        busy: false,
        error: undefined,
      },
      'uk',
    );

    expect(status.feedback).not.toContain('English fallback');
    expect(status.feedbackIssue?.code).toBe('articulated-font');
    expect(status.fixTarget).toBe('design');
  });

  it('targets print controls for structured width issues in Russian', () => {
    const status = previewStatus(
      {
        result: result({
          issues: [{ severity: 'error', code: 'text-too-wide', message: 'localized text' }],
          printable: false,
        }),
        busy: false,
        error: undefined,
      },
      'ru',
    );

    expect(status.fixTarget).toBe('print');
  });
});

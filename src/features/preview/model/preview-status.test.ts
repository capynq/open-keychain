import { describe, expect, it } from 'vitest';
import type { GeometryResult } from '../../../domain/keychain';
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
  });

  it('reports generation errors as attention required', () => {
    const status = previewStatus({ result: result(), busy: false, error: 'Worker failed.' }, 'en');

    expect(status.className).toBe('attention');
    expect(status.text).toContain('attention');
    expect(status.feedback).toBe('Worker failed.');
  });
});

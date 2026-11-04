import { describe, expect, it } from 'vitest';

import { readyRenderState } from './render-state';

describe('readyRenderState', () => {
  it('carries the session, generation and timings of the rendered result', () => {
    const timings = { renderedAt: 10, meshSetupMs: 1, drawSubmitMs: 2 };

    expect(readyRenderState(3, { generationId: 7 }, timings)).toEqual({
      status: 'ready',
      sessionId: 3,
      generationId: 7,
      timings,
    });
  });
});

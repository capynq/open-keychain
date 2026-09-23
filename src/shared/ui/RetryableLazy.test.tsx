import { describe, expect, it, vi } from 'vitest';

import { createRetryableLazy } from './RetryableLazy';

describe('createRetryableLazy', () => {
  it('shares an in-flight preload promise with other callers', async () => {
    let resolveModule: ((module: { default: () => null }) => void) | undefined;
    const loader = vi.fn(
      () =>
        new Promise<{ default: () => null }>((resolve) => {
          resolveModule = resolve;
        }),
    );
    const LazyComponent = createRetryableLazy(loader);
    const firstPreload = LazyComponent.preload();
    const secondPreload = LazyComponent.preload();

    expect(loader).toHaveBeenCalledTimes(1);
    resolveModule?.({ default: () => null });
    await Promise.all([firstPreload, secondPreload]);
  });

  it('allows a failed preload to be retried', async () => {
    const loader = vi
      .fn<() => Promise<{ default: () => null }>>()
      .mockRejectedValueOnce(new Error('Chunk request failed.'))
      .mockResolvedValueOnce({ default: () => null });
    const LazyComponent = createRetryableLazy(loader);

    await expect(LazyComponent.preload()).rejects.toThrow('Chunk request failed.');
    await expect(LazyComponent.preload()).resolves.toBeUndefined();
    expect(loader).toHaveBeenCalledTimes(2);
  });
});

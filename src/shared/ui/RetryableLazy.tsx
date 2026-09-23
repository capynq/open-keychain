import { lazy, useMemo, type ComponentType, type LazyExoticComponent } from 'react';

let retryGeneration = 0;

export const resetRetryableLazy = (): void => {
  retryGeneration += 1;
};

export const createRetryableLazy = <Props extends object>(
  loader: () => Promise<{ default: ComponentType<Props> }>,
): ComponentType<Props & { resetKey: string }> & { preload: () => Promise<void> } => {
  let cachedComponent: LazyExoticComponent<ComponentType<Props>>;
  let cachedGeneration = -1;
  let loadPromise: ReturnType<typeof loader> | undefined;

  const load = (): ReturnType<typeof loader> => {
    if (loadPromise) return loadPromise;

    const pending = loader();

    loadPromise = pending;
    void pending.catch(() => {
      if (loadPromise === pending) loadPromise = undefined;
    });

    return pending;
  };

  const RetryableLazy = ({ resetKey, ...props }: Props & { resetKey: string }) => {
    const LazyComponent = useMemo(() => {
      void resetKey;
      if (!cachedComponent || cachedGeneration !== retryGeneration) {
        cachedComponent = lazy(load);
        cachedGeneration = retryGeneration;
      }

      return cachedComponent;
    }, [resetKey]);

    return <LazyComponent {...(props as Props)} />;
  };

  return Object.assign(RetryableLazy, {
    preload: () => load().then(() => undefined),
  });
};

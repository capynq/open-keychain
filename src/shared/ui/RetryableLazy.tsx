import { lazy, useMemo, type ComponentType, type LazyExoticComponent } from 'react';

let retryGeneration = 0;

export const resetRetryableLazy = (): void => {
  retryGeneration += 1;
};

export const createRetryableLazy = <Props extends object>(
  loader: () => Promise<{ default: ComponentType<Props> }>,
) => {
  let cachedComponent: LazyExoticComponent<ComponentType<Props>>;
  let cachedGeneration = -1;

  const RetryableLazy = ({ resetKey, ...props }: Props & { resetKey: string }) => {
    const LazyComponent = useMemo(() => {
      void resetKey;
      if (!cachedComponent || cachedGeneration !== retryGeneration) {
        cachedComponent = lazy(loader);
        cachedGeneration = retryGeneration;
      }

      return cachedComponent;
    }, [resetKey]);

    return <LazyComponent {...(props as Props)} />;
  };

  return RetryableLazy;
};

const loadGeometryPool = () => import('../../infrastructure/geometry/geometry-client-pool');

let geometryPool: ReturnType<typeof loadGeometryPool> | undefined;

export const loadAndPrewarm = (shouldPrewarm: () => boolean = () => true): void => {
  geometryPool ??= loadGeometryPool();
  geometryPool
    .then(
      (pool) => {
        if (shouldPrewarm()) pool.prewarmGeometryClient();
      },
      () => {
        geometryPool = undefined;
      },
    )
    .catch(() => undefined);
};

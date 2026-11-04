import { GeometryClient } from './geometry-client';

export const PREWARM_TTL_MS = 5 * 60_000;

let pooled: { client: GeometryClient; timer: ReturnType<typeof setTimeout> } | undefined;

const discardPooled = (): void => {
  const entry = pooled;
  pooled = undefined;
  if (!entry) return;
  clearTimeout(entry.timer);
  entry.client.dispose();
};

export const prewarmGeometryClient = (): void => {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return;
  if (pooled?.client.isUsable()) return;
  discardPooled();
  const client = new GeometryClient();
  const timer = setTimeout(() => {
    if (pooled?.client !== client) return;
    pooled = undefined;
    client.dispose();
  }, PREWARM_TTL_MS);
  pooled = { client, timer };
};

export const takePrewarmedGeometryClient = (): GeometryClient | undefined => {
  const entry = pooled;
  pooled = undefined;
  if (!entry) return undefined;
  clearTimeout(entry.timer);
  if (!entry.client.isUsable()) {
    entry.client.dispose();
    return undefined;
  }
  return entry.client;
};

/** Whether this code is currently running in a browser document. */
export const isBrowser = (): boolean =>
  typeof window !== 'undefined' && typeof document !== 'undefined';

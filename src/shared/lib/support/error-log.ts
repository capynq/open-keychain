/**
 * In-memory log of the last few errors in this tab, included in a support report only when the
 * visitor chooses to email or copy it. Nothing is persisted or sent automatically.
 */

export type ErrorLogEntry = { at: number; source: string; message: string };

export const ERROR_LOG_LIMIT = 10;
export const ERROR_MESSAGE_LIMIT = 300;

const entries: ErrorLogEntry[] = [];
let installed = false;

const messageOf = (error: unknown): string => {
  if (error instanceof Error) return error.message || error.name;

  if (typeof error === 'string') return error;

  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
};

export const logError = (source: string, error: unknown, now = Date.now()): void => {
  const message = messageOf(error).replace(/\s+/g, ' ').trim().slice(0, ERROR_MESSAGE_LIMIT);

  if (!message) return;

  const previous = entries.at(-1);

  if (previous && previous.source === source && previous.message === message) {
    previous.at = now;

    return;
  }

  entries.push({ at: now, source: source.slice(0, 32), message });
  if (entries.length > ERROR_LOG_LIMIT) entries.splice(0, entries.length - ERROR_LOG_LIMIT);
};

export const recentErrors = (): readonly ErrorLogEntry[] => entries.map((entry) => ({ ...entry }));

export const clearErrorLog = (): void => {
  entries.length = 0;
};

/** Record uncaught errors and rejections. Safe to call more than once. */
export const installGlobalErrorLog = (target: Window = window): void => {
  if (installed) return;

  installed = true;
  target.addEventListener('error', (event) => logError('window', event.error ?? event.message));
  target.addEventListener('unhandledrejection', (event) => logError('promise', event.reason));
};

/**
 * Device-only feedback state. Nothing here is sent anywhere; it only decides when to ask.
 * `lastExport.designUrl` holds the share link of the last exported design so a later print
 * report can include it, and it leaves the device only in an email the visitor sends.
 */

export const FEEDBACK_STORAGE_KEY = 'open-keychain.feedback';

const DAY_MS = 24 * 60 * 60 * 1000;
export const EXPORT_PROMPT_ANSWERED_COOLDOWN_MS = 60 * DAY_MS;
export const EXPORT_PROMPT_SHOWN_COOLDOWN_MS = 14 * DAY_MS;
export const PRINT_CHECK_MIN_AGE_MS = 3 * 60 * 60 * 1000;
export const PRINT_CHECK_MAX_AGE_MS = 30 * DAY_MS;
const DESIGN_URL_LIMIT = 4000;

export type ExportFormatId = 'stl' | '3mf';

export type LastExport = {
  at: number;
  format?: ExportFormatId;
  template?: string;
  designUrl?: string;
};

export type FeedbackState = {
  lastExport?: LastExport;
  exportPromptedAt?: number;
  answeredAt?: number;
  printCheckDoneFor?: number;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const defaultStorage = (): StorageLike | undefined => {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

const finiteTime = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;

const parseLastExport = (value: unknown): LastExport | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const at = finiteTime(record.at);
  if (!at) return undefined;

  return {
    at,
    ...(record.format === 'stl' || record.format === '3mf' ? { format: record.format } : {}),
    ...(typeof record.template === 'string' && /^[a-z0-9-]{1,64}$/.test(record.template)
      ? { template: record.template }
      : {}),
    ...(typeof record.designUrl === 'string' &&
    record.designUrl.length <= DESIGN_URL_LIMIT &&
    /^https?:\/\//.test(record.designUrl)
      ? { designUrl: record.designUrl }
      : {}),
  };
};

export const readFeedbackState = (storage = defaultStorage()): FeedbackState => {
  try {
    const raw = storage?.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed !== 'object' || parsed === null) return {};
    const lastExport = parseLastExport(parsed.lastExport);
    const exportPromptedAt = finiteTime(parsed.exportPromptedAt);
    const answeredAt = finiteTime(parsed.answeredAt);
    const printCheckDoneFor = finiteTime(parsed.printCheckDoneFor);

    return {
      ...(lastExport ? { lastExport } : {}),
      ...(exportPromptedAt ? { exportPromptedAt } : {}),
      ...(answeredAt ? { answeredAt } : {}),
      ...(printCheckDoneFor ? { printCheckDoneFor } : {}),
    };
  } catch {
    return {};
  }
};

export const updateFeedbackState = (
  patch: Partial<FeedbackState>,
  storage = defaultStorage(),
): FeedbackState => {
  const next = { ...readFeedbackState(storage), ...patch };
  try {
    storage?.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify({ v: 1, ...next }));
  } catch {
    /* storage unavailable: the prompt simply asks again later */
  }
  return next;
};

export const shouldShowExportPrompt = (state: FeedbackState, now: number): boolean =>
  !(state.answeredAt && now - state.answeredAt < EXPORT_PROMPT_ANSWERED_COOLDOWN_MS) &&
  !(state.exportPromptedAt && now - state.exportPromptedAt < EXPORT_PROMPT_SHOWN_COOLDOWN_MS);

export const shouldShowPrintCheck = (state: FeedbackState, now: number): boolean => {
  const exportedAt = state.lastExport?.at;
  if (!exportedAt || state.printCheckDoneFor === exportedAt) return false;
  const age = now - exportedAt;
  return age >= PRINT_CHECK_MIN_AGE_MS && age <= PRINT_CHECK_MAX_AGE_MS;
};

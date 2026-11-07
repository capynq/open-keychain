import { describe, expect, it } from 'vitest';

import {
  EXPORT_PROMPT_ANSWERED_COOLDOWN_MS,
  EXPORT_PROMPT_SHOWN_COOLDOWN_MS,
  FEEDBACK_STORAGE_KEY,
  PRINT_CHECK_MAX_AGE_MS,
  PRINT_CHECK_MIN_AGE_MS,
  readFeedbackState,
  shouldShowExportPrompt,
  shouldShowPrintCheck,
  updateFeedbackState,
} from './feedback-storage';

const memoryStorage = (initial: Record<string, string> = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    values,
  };
};

const NOW = Date.UTC(2026, 10, 6, 12);

describe('feedback storage', () => {
  it('round-trips state and keeps only well-formed fields', () => {
    const storage = memoryStorage();
    updateFeedbackState(
      {
        lastExport: {
          at: NOW,
          format: '3mf',
          template: 'name-keychain',
          designUrl: 'https://open-keychain.com/create?design=abc',
        },
        exportPromptedAt: NOW,
      },
      storage,
    );

    expect(JSON.parse(storage.values.get(FEEDBACK_STORAGE_KEY) ?? '{}')).toMatchObject({ v: 1 });
    expect(readFeedbackState(storage)).toEqual({
      lastExport: {
        at: NOW,
        format: '3mf',
        template: 'name-keychain',
        designUrl: 'https://open-keychain.com/create?design=abc',
      },
      exportPromptedAt: NOW,
    });

    const tampered = memoryStorage({
      [FEEDBACK_STORAGE_KEY]: JSON.stringify({
        lastExport: {
          at: NOW,
          format: 'obj',
          template: 'Bad Id',
          designUrl: 'javascript:alert(1)',
        },
        answeredAt: 'yesterday',
      }),
    });
    expect(readFeedbackState(tampered)).toEqual({ lastExport: { at: NOW } });
  });

  it('survives broken JSON and blocked storage', () => {
    expect(readFeedbackState(memoryStorage({ [FEEDBACK_STORAGE_KEY]: '{' }))).toEqual({});
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readFeedbackState(blocked)).toEqual({});
    expect(updateFeedbackState({ answeredAt: NOW }, blocked)).toEqual({ answeredAt: NOW });
  });
});

describe('export prompt eligibility', () => {
  it('asks first-time exporters', () => {
    expect(shouldShowExportPrompt({}, NOW)).toBe(true);
  });

  it('waits 60 days after an answer and 14 days after an unanswered ask', () => {
    expect(shouldShowExportPrompt({ answeredAt: NOW - 1000 }, NOW)).toBe(false);
    expect(
      shouldShowExportPrompt({ answeredAt: NOW - EXPORT_PROMPT_ANSWERED_COOLDOWN_MS }, NOW),
    ).toBe(true);
    expect(shouldShowExportPrompt({ exportPromptedAt: NOW - 1000 }, NOW)).toBe(false);
    expect(
      shouldShowExportPrompt({ exportPromptedAt: NOW - EXPORT_PROMPT_SHOWN_COOLDOWN_MS }, NOW),
    ).toBe(true);
  });
});

describe('print check eligibility', () => {
  it('asks once per export between 3 hours and 30 days later', () => {
    const lastExport = { at: NOW - PRINT_CHECK_MIN_AGE_MS };

    expect(shouldShowPrintCheck({}, NOW)).toBe(false);
    expect(shouldShowPrintCheck({ lastExport: { at: NOW - 60_000 } }, NOW)).toBe(false);
    expect(shouldShowPrintCheck({ lastExport }, NOW)).toBe(true);
    expect(shouldShowPrintCheck({ lastExport, printCheckDoneFor: lastExport.at }, NOW)).toBe(false);
    expect(
      shouldShowPrintCheck({ lastExport: { at: NOW - PRINT_CHECK_MAX_AGE_MS - 1 } }, NOW),
    ).toBe(false);
  });
});

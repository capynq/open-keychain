import { afterEach, describe, expect, it } from 'vitest';

import { clearErrorLog, ERROR_LOG_LIMIT, logError, recentErrors } from './error-log';
import { fitMailBody, MAILTO_BODY_BUDGET, mailtoHref, SUPPORT_EMAIL } from './support-mail';
import {
  buildSupportReport,
  setSupportDesignUrlProvider,
  supportDesignUrl,
} from './support-report';

const bodyOf = (href: string): string => new URL(href).searchParams.get('body') ?? '';

describe('error log', () => {
  afterEach(() => clearErrorLog());

  it('keeps the last entries, collapses repeats and truncates long messages', () => {
    for (let index = 0; index < ERROR_LOG_LIMIT + 3; index += 1)
      logError('test', `error ${index}`, index);

    logError('test', `error ${ERROR_LOG_LIMIT + 2}`, 99);
    logError('test', new Error('x'.repeat(500)), 100);

    const entries = recentErrors();
    expect(entries).toHaveLength(ERROR_LOG_LIMIT);
    expect(entries.at(-2)).toEqual({
      at: 99,
      source: 'test',
      message: `error ${ERROR_LOG_LIMIT + 2}`,
    });
    expect(entries.at(-1)?.message).toHaveLength(300);
  });
});

describe('support mail', () => {
  it('addresses support with encoded subject and body', () => {
    const href = mailtoHref('Print result: Didn’t work', 'Line 1\nLine 2 & more');

    expect(href.startsWith(`mailto:${SUPPORT_EMAIL}?subject=`)).toBe(true);
    expect(bodyOf(href)).toBe('Line 1\nLine 2 & more');
  });

  it('drops low-priority sections first, then truncates without breaking characters', () => {
    const body = fitMailBody(
      [
        { lines: ['Intro'] },
        { dropOrder: 2, lines: ['Design: ' + 'd'.repeat(400)] },
        { dropOrder: 1, lines: ['Log: ' + 'ы'.repeat(400)] },
      ],
      1200,
    );

    expect(body).toContain('Intro');
    expect(body).toContain('Design:');
    expect(body).not.toContain('Log:');
    expect(() =>
      encodeURIComponent(fitMailBody([{ lines: ['🙂'.repeat(2000)] }], 300)),
    ).not.toThrow();
  });
});

describe('support report', () => {
  afterEach(() => {
    clearErrorLog();
    setSupportDesignUrlProvider(undefined);
  });

  it('includes the failure, app context, design link and recent errors', () => {
    logError('export', 'worker crashed', Date.UTC(2026, 10, 6, 21, 0, 1));
    const report = buildSupportReport({
      code: 'geometry-export-failed',
      message: 'The file could not be created.',
      diagnostic: 'Worker crashed',
      designUrl: 'https://open-keychain.com/create?design=abc',
      designNote: 'Design link:',
      intro: ['Hi team,'],
      locale: 'en',
      subject: 'Open Keychain error: geometry-export-failed',
      now: new Date(Date.UTC(2026, 10, 6, 21, 0, 2)),
      path: '/create',
      userAgent: 'TestBrowser/1.0',
    });

    expect(report.text).toContain('Error: The file could not be created. (geometry-export-failed)');
    expect(report.text).toContain('Details: Worker crashed');
    expect(report.text).toContain('Page: /create');
    expect(report.text).toContain('Browser: TestBrowser/1.0');
    expect(report.text).toContain('Design: https://open-keychain.com/create?design=abc');
    expect(report.text).toContain('- 21:00:01 export: worker crashed');
    expect(report.text).toMatch(/App: .+/);
    expect(bodyOf(report.mailtoHref)).toBe(report.text);
  });

  it('keeps the mailto link within budget by dropping the log before the design link', () => {
    for (let index = 0; index < 10; index += 1)
      logError('geometry', `failure ${index} ${'z'.repeat(250)}`, index);

    const report = buildSupportReport({
      code: 'preview-unavailable',
      message: 'Preview unavailable',
      designUrl: 'https://open-keychain.com/create?design=abc',
      intro: ['Hi'],
      locale: 'en',
      subject: 'Error',
    });
    const body = new URL(report.mailtoHref).searchParams.get('body') ?? '';

    expect(encodeURIComponent(body).length).toBeLessThanOrEqual(MAILTO_BODY_BUDGET);
    expect(body).toContain('Design: https://open-keychain.com/create?design=abc');
    expect(body).not.toContain('Recent errors:');
    expect(report.text).toContain('Recent errors:');
  });

  it('reads the registered design link and tolerates a failing provider', () => {
    setSupportDesignUrlProvider(() => 'https://open-keychain.com/create?design=xyz');
    expect(supportDesignUrl()).toBe('https://open-keychain.com/create?design=xyz');
    setSupportDesignUrlProvider(() => {
      throw new Error('no params');
    });
    expect(supportDesignUrl()).toBeUndefined();
  });
});

import process from 'node:process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlaywrightReporter from './validation-playwright-reporter.mjs';
import VitestReporter from './validation-vitest-reporter.mjs';

const statusEvents = (writeSpy) =>
  writeSpy.mock.calls
    .map(([chunk]) => String(chunk))
    .filter((line) => line.startsWith('\u001e'))
    .map((line) => JSON.parse(line.slice(1)));

beforeEach(() => vi.stubEnv('VALIDATION_EVENTS', '0'));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('validation runner reporters', () => {
  it('keeps Vitest lifecycle status separate from the test outcome', () => {
    vi.stubEnv('VALIDATION_EVENTS', '1');
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const reporter = new VitestReporter();
    reporter.onTestRunStart();
    reporter.onTestModuleCollected({
      type: 'module',
      children: [{ type: 'test', children: [] }],
    });
    reporter.onTestCaseReady({ id: 'case-1', fullName: 'sample test' });
    reporter.onTestCaseResult({
      id: 'case-1',
      fullName: 'sample test',
      result: () => ({ state: 'passed' }),
      diagnostic: () => ({ duration: 42 }),
    });

    expect(statusEvents(writeSpy).filter(({ status }) => status.startsWith('case-'))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'case-started', name: 'sample test' }),
        expect.objectContaining({ status: 'case-completed', outcome: 'passed' }),
      ]),
    );
    expect(statusEvents(writeSpy)).toContainEqual(
      expect.objectContaining({ status: 'case-completed', durationMs: 42 }),
    );
  });

  it('keeps Playwright lifecycle status separate from the test outcome', () => {
    vi.stubEnv('VALIDATION_GATE_ID', 'browser:journey');
    vi.stubEnv('VALIDATION_EVENTS', '1');
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const reporter = new PlaywrightReporter();
    const test = {
      titlePath: () => ['suite', 'browser test'],
      workerIndex: 2,
      id: 'browser-test-1',
    };
    reporter.onBegin({}, { allTests: () => [test] });
    reporter.onTestBegin(test, { workerIndex: 2 });
    reporter.onTestEnd(test, { status: 'passed', workerIndex: 2, duration: 42 });

    expect(statusEvents(writeSpy)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'gate-progress',
          phase: 'public browser',
          total: 1,
          gateId: 'browser:journey',
        }),
        expect.objectContaining({ status: 'case-started', workerId: 2 }),
        expect.objectContaining({
          status: 'case-completed',
          outcome: 'passed',
          workerId: 2,
          durationMs: 42,
          phase: 'public browser',
        }),
        expect.objectContaining({
          status: 'gate-progress',
          phase: 'public browser',
          testId: 'browser-test-1',
          completed: 1,
        }),
      ]),
    );
  });

  it('allows exactly six strict journey passes', () => {
    vi.stubEnv('PLAYWRIGHT_REQUIRED_JOURNEY', 'true');
    const reporter = new PlaywrightReporter();
    const tests = Array.from({ length: 6 }, (_, index) => ({
      id: `journey-${index}`,
      expectedStatus: 'passed',
      titlePath: () => ['journey', String(index)],
    }));
    reporter.onBegin({}, { allTests: () => tests });
    tests.forEach((test) => reporter.onTestEnd(test, { status: 'passed', duration: 1 }));

    expect(reporter.onEnd({ status: 'passed' })).toBeUndefined();
  });

  it.each([
    ['a skipped case', (index) => (index === 5 ? 'skipped' : 'passed'), () => 'passed'],
    ['an expected failure', () => 'failed', () => 'failed'],
    ['fewer than six cases', () => 'passed', () => 'passed'],
  ])('rejects strict journeys with %s', (_label, statusFor, expectedStatusFor) => {
    vi.stubEnv('PLAYWRIGHT_REQUIRED_JOURNEY', 'true');
    const errorSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const count = _label === 'fewer than six cases' ? 5 : 6;
    const reporter = new PlaywrightReporter();
    const tests = Array.from({ length: 6 }, (_, index) => ({
      id: `journey-${index}`,
      expectedStatus: expectedStatusFor(index),
      titlePath: () => ['journey', String(index)],
    }));
    reporter.onBegin({}, { allTests: () => tests });
    tests
      .slice(0, count)
      .forEach((test, index) =>
        reporter.onTestEnd(test, { status: statusFor(index), duration: 1 }),
      );

    expect(reporter.onEnd({ status: 'passed' })).toEqual({ status: 'failed' });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Critical journey verification failed'),
    );
  });

  it('keeps ordinary browser runs unchanged', () => {
    const reporter = new PlaywrightReporter();
    const test = { id: 'ordinary', expectedStatus: 'failed', titlePath: () => ['ordinary'] };
    reporter.onBegin({}, { allTests: () => [test] });
    reporter.onTestEnd(test, { status: 'failed', duration: 1 });

    expect(reporter.onEnd({ status: 'failed' })).toBeUndefined();
  });
});

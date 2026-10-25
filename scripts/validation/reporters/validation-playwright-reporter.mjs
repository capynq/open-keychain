import process from 'node:process';

const emit = (status, values = {}) => {
  if (process.env.VALIDATION_EVENTS === '1')
    process.stdout.write(
      `\u001e${JSON.stringify({ gateId: process.env.VALIDATION_GATE_ID ?? 'browser', status, ...values })}\n`,
    );
};
const phase =
  process.env.VITE_HOSTED_MODE === 'true'
    ? 'hosted workspace'
    : process.env.PLAYWRIGHT_SMOKE === 'true'
      ? 'browser smoke'
      : 'public browser';

export default class ValidationPlaywrightReporter {
  completed = 0;
  total = 0;
  results = [];
  onBegin(_config, suite) {
    this.completed = 0;
    this.total = suite.allTests().length;
    this.results = [];
    emit('gate-progress', {
      phase,
      completed: 0,
      total: this.total,
      detail: 'tests collected',
    });
  }
  onTestBegin(test, result) {
    emit('case-started', { name: test.titlePath().join(' › '), workerId: result.workerIndex });
  }
  onTestEnd(test, result) {
    this.completed += 1;
    this.results.push({ status: result.status, expectedStatus: test.expectedStatus });
    emit('case-completed', {
      name: test.titlePath().join(' › '),
      outcome: result.status,
      workerId: result.workerIndex,
      durationMs: result.duration,
      phase,
    });
    emit('gate-progress', {
      completed: this.completed,
      total: this.total,
      phase,
      testId: test.id,
      detail: test.titlePath().join(' › '),
    });
  }
  onEnd() {
    if (process.env.PLAYWRIGHT_REQUIRED_JOURNEY !== 'true') return undefined;
    const valid =
      this.total === 9 &&
      this.completed === 9 &&
      this.results.length === 9 &&
      this.results.every(
        ({ status, expectedStatus }) => status === 'passed' && expectedStatus === 'passed',
      );
    if (valid) return undefined;
    process.stderr.write(
      `Critical journey verification failed: expected 9 passed tests, received ${this.completed}/${this.total} completed; statuses: ${this.results.map(({ status, expectedStatus }) => `${status}/${expectedStatus}`).join(', ') || 'none'}\n`,
    );
    return { status: 'failed' };
  }
}

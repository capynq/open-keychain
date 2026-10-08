import process from 'node:process';

const emit = (status, values = {}) => {
  if (process.env.VALIDATION_EVENTS === '1')
    process.stdout.write(`\u001e${JSON.stringify({ gateId: 'browser', status, ...values })}\n`);
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
  onBegin(_config, suite) {
    this.completed = 0;
    this.total = suite.allTests().length;
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
    if (result.status === 'failed' || result.status === 'timedOut') {
      const errors = result.errors
        .map((error) => error.message ?? error.value?.message ?? String(error.value ?? error))
        .filter(Boolean)
        .join(' | ')
        .replace(/\s+/g, ' ')
        .slice(0, 2400);
      process.stderr.write(
        `[Playwright failure] ${test.titlePath().join(' › ')}: ${errors || result.status}\n`,
      );
    }
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
}

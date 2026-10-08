import process from 'node:process';

const emit = (status, values = {}) => {
  if (process.env.VALIDATION_EVENTS === '1')
    process.stdout.write(`\u001e${JSON.stringify({ gateId: 'browser', status, ...values })}\n`);
};

export default class ValidationPlaywrightReporter {
  completed = 0;
  total = 0;
  onBegin(_config, suite) {
    this.completed = 0;
    this.total = suite.allTests().length;
    emit('gate-progress', { completed: 0, total: this.total, detail: 'browser tests collected' });
  }
  onTestBegin(test, result) {
    emit('case-started', { name: test.titlePath().join(' › '), workerId: result.workerIndex });
  }
  onTestEnd(test, result) {
    this.completed += 1;
    emit('case-completed', {
      name: test.titlePath().join(' › '),
      outcome: result.status,
      workerId: result.workerIndex,
      durationMs: result.duration,
    });
    emit('gate-progress', {
      completed: this.completed,
      total: this.total,
      detail: test.titlePath().join(' › '),
    });
  }
}

import process from 'node:process';
import { performance } from 'node:perf_hooks';

const gateId = process.env.VALIDATION_GATE_ID ?? 'unit';
const emit = (status, values = {}) => {
  if (process.env.VALIDATION_EVENTS === '1')
    process.stdout.write(`\u001e${JSON.stringify({ gateId, status, ...values })}\n`);
};
const countTests = (task) => {
  if (task.type === 'test') return 1;
  return [...(task.children ?? [])].reduce((count, child) => count + countTests(child), 0);
};

export default class ValidationVitestReporter {
  completed = 0;
  total = 0;
  started = new Map();
  activeWorkerIds = new Map();
  nextWorkerId = 0;
  onTestRunStart() {
    this.completed = 0;
    this.total = 0;
    this.started.clear();
    this.activeWorkerIds.clear();
  }
  onTestModuleCollected(module) {
    const count = countTests(module);
    this.total += count;
    emit('gate-progress', {
      completed: this.completed,
      total: this.total,
      detail: 'collecting tests',
    });
  }
  onTestCaseReady(testCase) {
    this.started.set(testCase.id, performance.now());
    const workerId = `vitest-${++this.nextWorkerId}`;
    this.activeWorkerIds.set(testCase.id, workerId);
    emit('case-started', { name: testCase.fullName, workerId });
  }
  onTestCaseResult(testCase) {
    this.completed += 1;
    emit('case-completed', {
      name: testCase.fullName,
      outcome: testCase.result().state,
      durationMs: Math.round(
        performance.now() - (this.started.get(testCase.id) ?? performance.now()),
      ),
      workerId: this.activeWorkerIds.get(testCase.id) ?? `vitest-${++this.nextWorkerId}`,
    });
    this.started.delete(testCase.id);
    this.activeWorkerIds.delete(testCase.id);
    emit('gate-progress', {
      completed: this.completed,
      total: Math.max(this.total, this.completed),
      detail: testCase.fullName,
    });
  }
}

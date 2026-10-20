export type CandidateIntent = 'immediate' | 'continuous' | 'text';

/** Keep controls live without dispatching every pointer event to the geometry worker. */
export class CandidateScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastContinuousAt = -Infinity;

  schedule(intent: CandidateIntent, task: () => void): void {
    this.cancel();
    const delay =
      intent === 'text'
        ? 100
        : intent === 'continuous'
          ? Math.max(0, 32 - (performance.now() - this.lastContinuousAt))
          : 0;
    if (intent !== 'continuous') this.lastContinuousAt = -Infinity;
    const run = (): void => {
      this.timer = undefined;
      if (intent === 'continuous') this.lastContinuousAt = performance.now();
      task();
    };
    if (delay === 0) run();
    else this.timer = setTimeout(run, delay);
  }

  cancel(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
}

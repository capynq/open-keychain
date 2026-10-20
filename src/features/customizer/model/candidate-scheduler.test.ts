import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CandidateScheduler } from './candidate-scheduler';

describe('CandidateScheduler', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }));
  afterEach(() => vi.useRealTimers());

  it('dispatches discrete changes immediately and cancels pending typing', () => {
    const scheduler = new CandidateScheduler();
    const typing = vi.fn();
    const discrete = vi.fn();
    scheduler.schedule('text', typing);
    scheduler.schedule('immediate', discrete);
    expect(discrete).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(typing).not.toHaveBeenCalled();
  });

  it('debounces text for 100 ms after the last edit', () => {
    const scheduler = new CandidateScheduler();
    const old = vi.fn();
    const latest = vi.fn();
    scheduler.schedule('text', old);
    vi.advanceTimersByTime(80);
    scheduler.schedule('text', latest);
    vi.advanceTimersByTime(99);
    expect(latest).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(latest).toHaveBeenCalledOnce();
    expect(old).not.toHaveBeenCalled();
  });

  it('dispatches the first continuous edit immediately and the latest within 32 ms', () => {
    const scheduler = new CandidateScheduler();
    const first = vi.fn();
    const middle = vi.fn();
    const latest = vi.fn();
    scheduler.schedule('continuous', first);
    expect(first).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(10);
    scheduler.schedule('continuous', middle);
    vi.advanceTimersByTime(10);
    scheduler.schedule('continuous', latest);
    vi.advanceTimersByTime(12);
    expect(middle).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
  });

  it('keeps updating throughout a sustained drag and flushes its final value', () => {
    const scheduler = new CandidateScheduler();
    const applied: number[] = [];
    for (let value = 0; value <= 10; value += 1) {
      scheduler.schedule('continuous', () => applied.push(value));
      vi.advanceTimersByTime(10);
    }
    vi.runAllTimers();
    expect(applied.length).toBeGreaterThan(2);
    expect(applied.at(-1)).toBe(10);
  });

  it('releases pending work on cancellation', () => {
    const scheduler = new CandidateScheduler();
    const task = vi.fn();
    scheduler.schedule('text', task);
    scheduler.cancel();
    vi.runAllTimers();
    expect(task).not.toHaveBeenCalled();
  });
});

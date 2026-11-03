import os from 'node:os';
import process from 'node:process';

export const MAX_VALIDATION_CONCURRENCY = 8;

const availableCores = () => os.availableParallelism?.() ?? os.cpus().length;

/** Highest gate concurrency this machine accepts (1–8). */
export const maxValidationConcurrency = (cores = availableCores()) =>
  Math.max(1, Math.min(MAX_VALIDATION_CONCURRENCY, cores));

/**
 * Default gate concurrency. Small machines keep the historical `min(4, cores)`;
 * larger ones (for example a 10-core M-series Mac) leave two cores for the OS
 * and use the rest, so CPU-bound gates such as the geometry matrix scale.
 * `VALIDATION_CONCURRENCY` always overrides this.
 */
export const defaultValidationConcurrency = (cores = availableCores()) =>
  Math.min(maxValidationConcurrency(cores), Math.max(Math.min(4, cores), cores - 2, 1));

export const boundedConcurrency = (name, fallback, maximum, env = process.env) => {
  const value = env[name] ?? String(fallback);
  if (!/^[1-9]\d*$/.test(value) || Number(value) > maximum)
    throw new Error(`${name} must be an integer from 1 to ${maximum}; received ${value}`);
  return Number(value);
};

/** Gate concurrency selected for this run. */
export const validationConcurrency = (env = process.env) =>
  boundedConcurrency(
    'VALIDATION_CONCURRENCY',
    Math.min(defaultValidationConcurrency(), maxValidationConcurrency()),
    MAX_VALIDATION_CONCURRENCY,
    env,
  );

/**
 * Vitest / Playwright workers for the unit and full-browser gates: half the gate
 * budget so cheap gates can run alongside, never fewer than the historical two.
 */
export const unitWorkerCount = (env = process.env) =>
  Math.max(2, Math.floor(validationConcurrency(env) / 2));

export type RecoveryFailureContext = {
  target?: 'base' | 'text';
  profile?: 'sharp' | 'round' | 'chamfer';
  maximumMm?: number;
  requestedMm?: number;
  parameter?: 'cornerRadiusMm' | 'stakeShoulderMm';
  [key: string]: string | number | undefined;
};

export type RecoveryFailure = {
  code: string;
  message?: string;
  context?: RecoveryFailureContext;
};

export class RecoveryError extends Error {
  readonly failure: RecoveryFailure;

  constructor(failure: RecoveryFailure) {
    super(failure.message ?? failure.code);
    this.name = 'RecoveryError';
    this.failure = failure;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const recoveryContext = (value: unknown): RecoveryFailureContext | undefined => {
  if (!isRecord(value)) return undefined;

  const context: RecoveryFailureContext = {};

  if (value.target === 'base' || value.target === 'text') context.target = value.target;

  if (value.profile === 'sharp' || value.profile === 'round' || value.profile === 'chamfer')
    context.profile = value.profile;

  for (const key of ['maximumMm', 'requestedMm'] as const) {
    if (typeof value[key] === 'number' && Number.isFinite(value[key])) context[key] = value[key];
  }

  if (value.parameter === 'cornerRadiusMm' || value.parameter === 'stakeShoulderMm')
    context.parameter = value.parameter;

  return Object.keys(context).length ? context : undefined;
};

const structuredFailure = (value: Record<string, unknown>): RecoveryFailure | undefined => {
  if (typeof value.code !== 'string') return undefined;

  const context = recoveryContext(value.context);

  return {
    code: value.code,
    ...(typeof value.message === 'string' ? { message: value.message } : {}),
    ...(context ? { context } : {}),
  };
};

export const failureFrom = (error: unknown, fallbackCode = 'unknown-failure'): RecoveryFailure => {
  if (error instanceof RecoveryError) return error.failure;

  if (isRecord(error)) {
    const candidate = error.failure;

    if (isRecord(candidate)) {
      const failure = structuredFailure(candidate);

      if (failure) return failure;
    }

    const failure = structuredFailure(error);

    if (failure) return failure;
  }

  return {
    code: fallbackCode,
    ...(error instanceof Error && error.message ? { message: error.message } : {}),
  };
};

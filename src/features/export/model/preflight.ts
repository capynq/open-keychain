import {
  DEFAULT_PRINT_PROFILE,
  printProfileFor,
  type GeometryConstraints,
} from '../../../domain/keychain';
import type {
  GeometryResult,
  PrintAppearance,
  PrintProfile,
  ValidationIssue,
} from '../../../domain/keychain';

export type PreflightStatus = 'generating' | 'ready' | 'ready-with-warnings' | 'blocked';

export type PreflightReport = {
  status: PreflightStatus;
  printable: boolean;
  dimensions: GeometryResult['dimensions'] | undefined;
  profile: PrintProfile | undefined;
  constraints: GeometryConstraints | undefined;
  appearance: PrintAppearance | undefined;
  issues: ValidationIssue[];
};

/** Collects generation validation and manufacturing metadata for the export handoff. */
export const buildPreflightReport = (
  result: GeometryResult | undefined,
  appearance: PrintAppearance | undefined = result?.appearance,
  busy = false,
  error?: string,
): PreflightReport => {
  if (busy || error || !result) {
    return {
      status: error ? 'blocked' : 'generating',
      printable: false,
      dimensions: undefined,
      profile: undefined,
      constraints: undefined,
      appearance: undefined,
      issues: error ? [{ severity: 'error', code: 'generation-error', message: error }] : [],
    };
  }
  const hasErrors = result.issues.some((issue) => issue.severity === 'error');
  const hasWarnings = result.issues.some((issue) => issue.severity === 'warning');

  const constraints: GeometryConstraints | undefined = result.constraints;

  return {
    status:
      !result.printable || hasErrors ? 'blocked' : hasWarnings ? 'ready-with-warnings' : 'ready',
    printable: result.printable && !hasErrors,
    dimensions: result.dimensions,
    profile:
      result.printProfile ?? (constraints ? printProfileFor(constraints) : DEFAULT_PRINT_PROFILE),
    constraints:
      constraints ?? result.printProfile?.constraints ?? DEFAULT_PRINT_PROFILE.constraints,
    appearance,
    issues: result.issues,
  };
};

import type { RecoveryFailure } from './failure';

import { RecoveryError } from './failure';

export type OperationDiagnostics = {
  stage:
    'initialization' | 'normalization' | 'generation' | 'serialization' | 'transport' | 'download';
  type: 'timeout' | 'worker_error' | 'message_error' | 'worker_unavailable' | 'operation_error';
};

export class GeometryOperationError extends RecoveryError {
  constructor(
    failure: RecoveryFailure,
    readonly diagnostics: OperationDiagnostics,
  ) {
    super(failure);
  }
}

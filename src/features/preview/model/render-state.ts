import type { RecoveryFailure } from '@/shared/lib/recovery/failure';

export type ViewerRenderTimings = {
  renderedAt: number;
  meshSetupMs: number;
  drawSubmitMs: number;
  initializationMs?: number;
};

export type PreviewRenderState =
  | { status: 'initializing' | 'recovering'; sessionId: number }
  | { status: 'ready'; sessionId: number; generationId: number; timings?: ViewerRenderTimings }
  | { status: 'failed'; sessionId: number; failure: RecoveryFailure };

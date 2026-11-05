export type QueuedExportAction = 'none' | 'wait' | 'open' | 'cancel';

export type QueuedExportState = {
  queued: boolean;
  canExport: boolean;
  waiting: boolean;
  /** A check rejected or failed after Export was clicked, so the click no longer matches the design. */
  rejectedSinceQueued: boolean;
};

/**
 * Decides what an Export click made during a check does next: it opens only for the edit that
 * passed, and a rejected or failed check cancels it instead of exporting the restored design.
 */
export const queuedExportAction = ({
  queued,
  canExport,
  waiting,
  rejectedSinceQueued,
}: QueuedExportState): QueuedExportAction => {
  if (!queued) return 'none';
  if (rejectedSinceQueued) return 'cancel';
  if (canExport) return 'open';
  return waiting ? 'wait' : 'cancel';
};

/** Identifies one candidate outcome, so a rejection already on screen at click time is not new. */
export const candidateOutcomeSignature = (
  feedback: { requestId: number; attemptId?: string; status: string } | undefined,
): string => (feedback ? `${feedback.attemptId ?? feedback.requestId}:${feedback.status}` : '');

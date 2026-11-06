import { describe, expect, it } from 'vitest';

import { candidateOutcomeSignature, isExportWaiting, queuedExportAction } from './queued-export';

const state = {
  queued: true,
  canExport: false,
  waiting: true,
  rejectedSinceQueued: false,
};

describe('queuedExportAction', () => {
  it('waits during the check and opens once the latest edit is accepted', () => {
    expect(queuedExportAction(state)).toBe('wait');
    expect(queuedExportAction({ ...state, canExport: true, waiting: false })).toBe('open');
  });

  it('cancels instead of exporting the restored design when the queued check is rejected', () => {
    expect(
      queuedExportAction({ ...state, canExport: true, waiting: false, rejectedSinceQueued: true }),
    ).toBe('cancel');
    expect(queuedExportAction({ ...state, rejectedSinceQueued: true })).toBe('cancel');
  });

  it('cancels when nothing is pending any more and does nothing without a queued click', () => {
    expect(queuedExportAction({ ...state, waiting: false })).toBe('cancel');
    expect(queuedExportAction({ ...state, queued: false, canExport: true })).toBe('none');
  });
});

describe('candidateOutcomeSignature', () => {
  it('changes when the queued attempt moves from checking to rejected', () => {
    const checking = { requestId: 4, attemptId: 'a', status: 'checking' };
    const rejected = { ...checking, status: 'rejected' };

    expect(candidateOutcomeSignature(checking)).not.toBe(candidateOutcomeSignature(rejected));
    expect(candidateOutcomeSignature(undefined)).toBe('');
  });
});

describe('isExportWaiting', () => {
  const loading = {
    randomizing: false,
    canExport: false,
    checking: false,
    busy: false,
    current: false,
    failed: false,
    staleResult: false,
  };

  it('waits while the first preview or a check is still running', () => {
    expect(isExportWaiting(loading)).toBe(true);
    expect(isExportWaiting({ ...loading, current: true, busy: true })).toBe(true);
    expect(isExportWaiting({ ...loading, current: true, checking: true })).toBe(true);
  });

  it('stops waiting once preview generation has failed, so a queued click is cancelled', () => {
    const failed = { ...loading, failed: true };

    expect(isExportWaiting(failed)).toBe(false);
    expect(
      queuedExportAction({
        queued: true,
        canExport: false,
        waiting: isExportWaiting(failed),
        rejectedSinceQueued: false,
      }),
    ).toBe('cancel');
  });

  it('does not wait when export is already possible or a randomization is running', () => {
    expect(isExportWaiting({ ...loading, canExport: true })).toBe(false);
    expect(isExportWaiting({ ...loading, randomizing: true })).toBe(false);
  });
});

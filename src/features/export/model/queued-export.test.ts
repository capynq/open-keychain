import { describe, expect, it } from 'vitest';

import { candidateOutcomeSignature, queuedExportAction } from './queued-export';

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

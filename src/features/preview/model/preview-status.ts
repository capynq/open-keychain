import type { GeometryResult, ValidationIssue } from '../../../domain/keychain/model/types';
import type { Locale } from '../../../infrastructure/i18n/config';

import { issueMessage, t } from '../../../infrastructure/i18n/utils';

export type PreviewFixTarget = 'design' | 'print' | 'essentials';

export type PreviewStatus = {
  feedback: string | undefined;
  feedbackIssue: ValidationIssue | undefined;
  fixTarget: PreviewFixTarget;
  className: 'updating' | 'attention' | 'adjusted' | 'ready';
  text: string;
};

export type PreviewStatusInput = {
  result: GeometryResult | undefined;
  busy: boolean;
  error: string | undefined;
  current?: boolean;
};

const DESIGN_ISSUES = new Set([
  'font-load',
  'missing-glyph',
  'subtitle-font-load',
  'subtitle-missing-glyph',
  'articulated-font',
  'empty-outline',
]);

const PRINT_ISSUES = new Set([
  'text-too-wide',
  'text-over-width',
  'scaled-to-fit',
  'relief-outside-backing',
  'nameplate-text-outside-plate',
  'nameplate-embedding',
  'magnet-base-adjusted',
  'magnet-pocket-adjusted',
  'magnet-pocket-unsafe',
  'disconnected',
  'dense-mesh',
  'shallow-relief',
  'articulated-manifold',
  'articulated-shell-count',
  'articulated-base-adjusted',
  'articulated-captive',
  'articulated-counter',
  'articulated-body-collision',
  'articulated-connector-collision',
  'articulated-motion-collision',
]);

export const previewFixTarget = (
  issue: Pick<ValidationIssue, 'code'> | undefined,
): PreviewFixTarget => {
  if (!issue) return 'essentials';
  if (DESIGN_ISSUES.has(issue.code)) return 'design';
  if (PRINT_ISSUES.has(issue.code)) return 'print';
  return 'essentials';
};

export const previewStatus = (
  { result, busy, error, current = true }: PreviewStatusInput,
  locale: Locale,
): PreviewStatus => {
  const errorIssue = result?.issues.find((item) => item.severity === 'error');
  const warningIssue = result?.issues.find((item) => item.severity === 'warning');
  const feedbackIssue = errorIssue ?? warningIssue;
  const needsAttention = Boolean(error || (!busy && result && (!result.printable || errorIssue)));
  const className = needsAttention
    ? 'attention'
    : busy || !current
      ? 'updating'
      : warningIssue
        ? 'adjusted'
        : 'ready';
  const text = needsAttention
    ? t(locale, 'needsAttention')
    : busy || !current
      ? t(locale, 'printCheckPending')
      : warningIssue
        ? t(locale, 'adjusted')
        : t(locale, 'ready');
  const feedback =
    error ??
    (errorIssue
      ? issueMessage(locale, errorIssue)
      : warningIssue
        ? issueMessage(locale, warningIssue)
        : !busy && result && !result.printable
          ? t(locale, 'errorNotReady')
          : undefined);
  return { feedback, feedbackIssue, fixTarget: previewFixTarget(feedbackIssue), className, text };
};

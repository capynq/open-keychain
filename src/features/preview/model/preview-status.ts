import type { GeometryResult } from '../../../domain/keychain';
import { issueMessage, t, type Locale } from '../../../infrastructure/i18n';

export type PreviewStatus = {
  feedback: string | undefined;
  className: 'updating' | 'attention' | 'adjusted' | 'ready';
  text: string;
};

export type PreviewStatusInput = {
  result: GeometryResult | undefined;
  busy: boolean;
  error: string | undefined;
};

export const previewStatus = (
  { result, busy, error }: PreviewStatusInput,
  locale: Locale,
): PreviewStatus => {
  const errorIssue = result?.issues.find((item) => item.severity === 'error');
  const warningIssue = result?.issues.find((item) => item.severity === 'warning');
  const needsAttention = Boolean(error || (!busy && result && (!result.printable || errorIssue)));
  const className = busy
    ? 'updating'
    : needsAttention
      ? 'attention'
      : warningIssue
        ? 'adjusted'
        : 'ready';
  const text = busy
    ? t(locale, 'updating')
    : needsAttention
      ? t(locale, 'needsAttention')
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
  return { feedback, className, text };
};

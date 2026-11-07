import type { RecoveryFailure } from '@/shared/lib/recovery/failure';
import type { RecoveryNoticeReport } from '@/shared/ui/RecoveryNotice';

import { useAnalytics } from '@/infrastructure/telemetry/useTelemetry';

import type { Locale } from '../../../infrastructure/i18n/config';

import { recoveryReport, type RecoveryReportOptions } from '../model/recovery-report';

/** Recovery report factory that also counts (with consent) how often visitors reach support. */
export const useRecoveryReport = (
  locale: Locale,
): ((
  failure: RecoveryFailure,
  options: Omit<RecoveryReportOptions, 'onOpen'>,
) => RecoveryNoticeReport) => {
  const { track } = useAnalytics();

  return (failure, options) =>
    recoveryReport(locale, failure, {
      ...options,
      onOpen: () =>
        track('support_contact_opened', { reason: 'error', recovery_code: failure.code }),
    });
};

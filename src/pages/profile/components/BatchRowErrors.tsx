import type { BatchRowError } from '@/features/hosted/model/name-keychain-batch';

import type { Locale } from '../../../infrastructure/i18n/config';

import { t } from '../../../infrastructure/i18n/utils';

export const BatchRowErrors = ({ locale, errors }: { locale: Locale; errors: BatchRowError[] }) => {
  if (errors.length === 0) return null;

  return (
    <ul className="profile-batch-errors" role="alert">
      {errors.map((error) => (
        <li key={`${error.line}-${error.reason}`}>
          {error.line > 0 ? t(locale, 'batchLine', { line: error.line }) : ''} {error.reason}
        </li>
      ))}
    </ul>
  );
};

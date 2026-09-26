import type { BillingStatus } from '@/features/hosted/api/hosted-api';

import type { Locale } from '../../../infrastructure/i18n/config';

import { t } from '../../../infrastructure/i18n/utils';

const dateLabel = (locale: Locale, value: string | null): string =>
  value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value)) : '';

export const ProfileBilling = ({
  locale,
  status,
  billingError,
  billingBusy,
  onRetry,
  onCheckout,
  onPortal,
  emailVerified,
  billingActionError,
}: {
  locale: Locale;
  status: BillingStatus;
  billingError?: string;
  billingBusy: boolean;
  onRetry: () => void;
  onCheckout: (interval: 'month' | 'year') => void;
  onPortal: () => void;
  emailVerified?: boolean;
  billingActionError?: string;
}) => {
  const attention = status.status === 'past_due' || status.status === 'scheduled_cancel';
  const expired = status.status === 'expired';
  const maker = status.plan === 'maker';
  const verified = emailVerified === true;

  return (
    <section className="profile-card profile-billing" aria-labelledby="billing-title">
      {emailVerified === false && (
        <div className="profile-attention" role="status">
          <p>{t(locale, 'billingVerifyEmail')}</p>
          <button type="button" onClick={onRetry}>
            {t(locale, 'billingCheckVerification')}
          </button>
        </div>
      )}
      <div className="profile-card-heading">
        <h2 id="billing-title">{t(locale, 'billingTitle')}</h2>
        <span className="profile-plan-badge">
          {maker ? t(locale, 'billingMaker') : t(locale, 'billingFree')}
        </span>
      </div>
      {billingActionError && (
        <p className="profile-error" role="alert">
          {billingActionError}
        </p>
      )}
      {billingError ? (
        <div className="profile-attention" role="status">
          <p>{t(locale, 'billingUnavailable')}</p>
          <button type="button" onClick={onRetry} disabled={billingBusy}>
            {billingBusy ? t(locale, 'billingRetrying') : t(locale, 'billingRetry')}
          </button>
        </div>
      ) : attention ? (
        <div className="profile-attention" role="alert">
          <p>
            {t(locale, status.status === 'past_due' ? 'billingPastDue' : 'billingScheduledCancel')}
          </p>
          <button type="button" onClick={onPortal} disabled={!verified}>
            {t(locale, 'billingRecover')}
          </button>
        </div>
      ) : expired ? (
        <div className="profile-attention" role="status">
          <p>{t(locale, 'billingExpired')}</p>
          <button type="button" onClick={() => onCheckout('month')} disabled={!verified}>
            {t(locale, 'billingStartMaker')}
          </button>
        </div>
      ) : maker ? (
        <p className="profile-billing-copy">
          {status.status === 'trialing' ? t(locale, 'billingTrial') : t(locale, 'billingActive')}
          {status.currentPeriodEnd &&
            ` ${t(locale, 'billingRenews', { date: dateLabel(locale, status.currentPeriodEnd) })}`}
        </p>
      ) : (
        <div className="profile-billing-copy">
          <p>{t(locale, 'billingFreeCopy')}</p>
          <p className="profile-billing-price">{t(locale, 'billingPrice')}</p>
          <p>{t(locale, 'billingTrialTerms')}</p>
          <div className="profile-billing-actions">
            <button type="button" onClick={() => onCheckout('month')} disabled={!verified}>
              {t(locale, 'billingStartMonthly')}
            </button>
            <button type="button" onClick={() => onCheckout('year')} disabled={!verified}>
              {t(locale, 'billingStartYearly')}
            </button>
          </div>
        </div>
      )}
      <p className="profile-billing-privacy">{t(locale, 'billingPrivacy')}</p>
    </section>
  );
};

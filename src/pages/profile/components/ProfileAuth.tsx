import type { FormEventHandler } from 'react';

import type { Locale } from '../../../infrastructure/i18n';

import { t } from '../../../infrastructure/i18n';

export const ProfileAuth = ({
  locale,
  authMode,
  name,
  email,
  password,
  authBusy,
  authError,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onToggleMode,
}: {
  locale: Locale;
  authMode: 'sign-in' | 'sign-up';
  name: string;
  email: string;
  password: string;
  authBusy: boolean;
  authError?: string;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onToggleMode: () => void;
}) => (
  <section className="profile-card profile-auth">
    <form onSubmit={onSubmit}>
      <h2>{authMode === 'sign-up' ? t(locale, 'createAccount') : t(locale, 'signIn')}</h2>
      {authMode === 'sign-up' && (
        <label>
          {t(locale, 'fullName')}
          <input value={name} onChange={(event) => onNameChange(event.target.value)} required />
        </label>
      )}
      <label>
        {t(locale, 'email')}
        <input
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          required
        />
      </label>
      <label>
        {t(locale, 'password')}
        <input
          type="password"
          minLength={10}
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          required
        />
      </label>
      {authError && (
        <p className="profile-error" role="alert">
          {authError}
        </p>
      )}
      <button type="submit" disabled={authBusy}>
        {authBusy
          ? t(locale, 'updating')
          : authMode === 'sign-up'
            ? t(locale, 'createAccount')
            : t(locale, 'signIn')}
      </button>
      <button type="button" className="profile-text-button" onClick={onToggleMode}>
        {authMode === 'sign-in' ? t(locale, 'createAccount') : t(locale, 'signIn')}
      </button>
    </form>
  </section>
);

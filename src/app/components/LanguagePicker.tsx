import type { Locale } from '../../infrastructure/i18n';
import { t } from '../../infrastructure/i18n';

export const LanguagePicker = ({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}) => (
  <label className="language-picker">
    <span className="sr-only">{t(locale, 'language')}</span>
    <select value={locale} onChange={(event) => onLocaleChange(event.target.value as Locale)}>
      <option value="en">🇬🇧 — English</option>
      <option value="ru">🇷🇺 — Русский</option>
      <option value="uk">🇺🇦 — Українська</option>
    </select>
  </label>
);

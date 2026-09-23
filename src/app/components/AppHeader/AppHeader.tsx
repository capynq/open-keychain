import type { Locale } from '../../../infrastructure/i18n/config';

import { LandingNavigationHeader } from '../LandingNavigationHeader/LandingNavigationHeader';
import './AppHeader.module.css';

export const AppHeader = ({
  locale,
  onLocaleChange,
}: {
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
}) => <LandingNavigationHeader locale={locale} onLocaleChange={onLocaleChange} />;

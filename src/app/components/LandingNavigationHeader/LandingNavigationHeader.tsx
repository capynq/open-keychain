import { Link } from 'react-router';

import type { Locale } from '@/infrastructure/i18n';

import { PROFILE_ROUTE } from '@/app/routes';
import { hostedMode } from '@/features/hosted/config';
import { t } from '@/infrastructure/i18n';

import { BrandMark } from '../BrandMark/BrandMark';
import { createPath } from '../landing/content';
import { LanguagePicker } from '../LanguagePicker/LanguagePicker';
import styles from './LandingNavigationHeader.module.css';

export type SeoNavigation = {
  homePath: string;
  templatesPath: string;
  guidesPath: string;
  howItWorksPath: string;
  languagePaths: Record<Locale, string>;
  templatesLabel: string;
  guidesLabel: string;
  howItWorksLabel: string;
  onLocaleChange: (locale: Locale) => void;
};

export type LandingNavigationHeaderProps = {
  locale: Locale;
  onLocaleChange?: (locale: Locale) => void;
  seo?: SeoNavigation;
};

export const LandingNavigationHeader = ({
  locale,
  onLocaleChange,
  seo,
}: LandingNavigationHeaderProps) => (
  <header className={`${styles.root} topbar landing-topbar`}>
    <BrandMark locale={locale} to={seo?.homePath} />
    <nav className="landing-nav" aria-label={t(locale, 'landing.navigation')}>
      {seo ? (
        <>
          <Link to={seo.templatesPath}>{seo.templatesLabel}</Link>
          <Link to={seo.guidesPath}>{seo.guidesLabel}</Link>
          <Link to={seo.howItWorksPath}>{seo.howItWorksLabel}</Link>
        </>
      ) : (
        <>
          <a href="#how-it-works">{t(locale, 'landing.navHow')}</a>
          <a href="#products">{t(locale, 'landing.navProducts')}</a>
          <a href="#run">{t(locale, 'landing.navRun')}</a>
          <a href="#faq">{t(locale, 'landing.navFaq')}</a>
        </>
      )}
    </nav>
    <div className="topbar-actions landing-topbar-actions">
      {seo ? (
        <LanguagePicker locale={locale} onLocaleChange={seo.onLocaleChange} />
      ) : (
        <LanguagePicker locale={locale} onLocaleChange={onLocaleChange!} />
      )}
      {hostedMode && (
        <Link className="header-profile-link" to={PROFILE_ROUTE}>
          {t(locale, 'profile')}
        </Link>
      )}
      <Link className="landing-header-cta" to={createPath(locale)}>
        {t(locale, 'landing.startDesigning')}
      </Link>
    </div>
  </header>
);

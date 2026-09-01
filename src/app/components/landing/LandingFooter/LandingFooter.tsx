import { Link } from 'react-router';

import type { Locale } from '@/infrastructure/i18n';

import { t } from '@/infrastructure/i18n';

import styles from './LandingFooter.module.css';

export const LandingFooter = ({ locale }: { locale: Locale }) => (
  <footer className={`${styles.root} landing-footer`}>
    <span>{t(locale, 'brandName')}</span>
    <span>{t(locale, 'landing.footerLicense')}</span>
    <Link to="/privacy">{t(locale, 'seo.navigation.privacy')}</Link>
    <a href="https://github.com/capynq/open-keychain">{t(locale, 'github')}</a>
  </footer>
);

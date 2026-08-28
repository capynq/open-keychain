import type { Locale } from '@/infrastructure/i18n';
import { t } from '@/infrastructure/i18n';
import styles from './LandingFooter.module.css';

export const LandingFooter = ({ locale }: { locale: Locale }) => (
  <footer className={`${styles.root} landing-footer`}>
    <span>Open Keychain</span>
    <span>{t(locale, 'landing.footerLicense')}</span>
    <a href="https://github.com/capynq/open-keychain">GitHub</a>
  </footer>
);

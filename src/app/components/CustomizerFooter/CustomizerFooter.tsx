import type { Locale } from '../../../infrastructure/i18n';
import { t } from '../../../infrastructure/i18n';
import styles from './CustomizerFooter.module.css';

export const CustomizerFooter = ({ locale }: { locale: Locale }) => (
  <footer className={`${styles.root} customizer-footer`}>
    <span>Open Keychain</span>
    <span>{t(locale, 'landing.footerLicense')}</span>
    <a href="https://github.com/capynq/open-keychain">{t(locale, 'openSource')}</a>
  </footer>
);

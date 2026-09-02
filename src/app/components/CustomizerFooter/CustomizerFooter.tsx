import type { Locale } from '../../../infrastructure/i18n/config';

import { t } from '../../../infrastructure/i18n/utils';
import styles from './CustomizerFooter.module.css';

export const CustomizerFooter = ({ locale }: { locale: Locale }) => (
  <footer className={`${styles.root} customizer-footer`}>
    <span>{t(locale, 'brandName')}</span>
    <span>{t(locale, 'landing.footerLicense')}</span>
    <a href="https://github.com/capynq/open-keychain">{t(locale, 'openSource')}</a>
  </footer>
);

import { Link } from 'react-router';

import type { Locale } from '../../../infrastructure/i18n/config';

import { t } from '../../../infrastructure/i18n/utils';
import { LANDING_ROUTE } from '../../routes';
import styles from './BrandMark.module.css';

export const BrandMark = ({ locale, to = LANDING_ROUTE }: { locale: Locale; to?: string }) => (
  <Link className={`${styles.root} brand-mark`} to={to} aria-label={t(locale, 'brandName')}>
    <img src="/brand/open-keychain-mark.svg" alt="" width="34" height="34" />
    <span>{t(locale, 'brandName')}</span>
  </Link>
);

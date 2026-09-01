import { Link } from 'react-router';

import { seoHomePath, type SeoRoute } from '@/features/seo';

import { type Locale } from '../../infrastructure/i18n/config';
import { t } from '../../infrastructure/i18n/utils';
import { SeoFooter } from './components/SeoFooter';
import { SeoHeader } from './components/SeoHeader';
import { SeoShell } from './components/SeoShell';

const homeRoute = (locale: Locale): SeoRoute & { kind: 'home' } => ({
  kind: 'home',
  locale,
  path: seoHomePath(locale),
});

export const SeoNotFoundPage = ({ locale = 'en' }: { locale?: Locale }) => (
  <SeoShell>
    <SeoHeader locale={locale} route={homeRoute(locale)} />
    <main className="seo-main">
      <h1>{t(locale, 'seo.notFoundTitle')}</h1>
      <p>{t(locale, 'seo.home.description')}</p>
      <Link className="seo-cta" to={seoHomePath(locale)}>
        {t(locale, 'seo.navigation.home')}
      </Link>
    </main>
    <SeoFooter locale={locale} />
  </SeoShell>
);

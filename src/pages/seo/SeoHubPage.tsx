import { Link } from 'react-router';
import { t, type Locale } from '../../infrastructure/i18n';
import {
  SEO_GUIDE_CATALOG,
  SEO_GUIDE_COPY,
  SEO_HUB_COPY,
  SEO_TEMPLATE_CATALOG,
  seoGuidePath,
  seoTemplatePath,
  type SeoRoute,
} from '@/features/seo';
import { CreateLink, SeoFooter, SeoHeader, SeoShell } from './components';
import type { SeoCtaClick, SeoLocaleChange } from './model';
import { templateTranslationKey } from './lib/translation';

export const SeoHubPage = ({
  locale,
  route,
  onCtaClick,
  onLocaleChange,
}: {
  locale: Locale;
  route: SeoRoute & { kind: 'templates' | 'guides' };
  onCtaClick?: SeoCtaClick;
  onLocaleChange?: SeoLocaleChange;
}) => {
  const isGuides = route.kind === 'guides';
  const heading = isGuides ? SEO_HUB_COPY[locale].heading : t(locale, 'seo.home.templatesHeading');
  const intro = isGuides ? SEO_HUB_COPY[locale].intro : t(locale, 'seo.home.templatesBody');

  return (
    <SeoShell>
      <SeoHeader locale={locale} route={route} onLocaleChange={onLocaleChange} />
      <main className="seo-main seo-hub">
        <h1>{heading}</h1>
        <p className="seo-lede">{intro}</p>
        {isGuides ? (
          <ul className="seo-resource-list">
            {SEO_GUIDE_CATALOG.map((guide) => (
              <li className="seo-resource-card" key={guide.slug}>
                <Link to={seoGuidePath(locale, guide)}>
                  {SEO_GUIDE_COPY[locale][guide.key].heading}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="seo-resource-list">
            {SEO_TEMPLATE_CATALOG.map((template) => (
              <li className="seo-resource-card" key={template.id}>
                <Link to={seoTemplatePath(locale, template)}>
                  {t(locale, `seo.templates.${templateTranslationKey(template.id)}.heading`)}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <CreateLink locale={locale} onCtaClick={onCtaClick} cta="create">
          {t(locale, 'seo.home.cta')}
        </CreateLink>
      </main>
      <SeoFooter locale={locale} />
    </SeoShell>
  );
};

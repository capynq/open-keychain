import { Link } from 'react-router';

import {
  SEO_GUIDE_CATALOG,
  SEO_GUIDE_COPY,
  SEO_TEMPLATE_CATALOG,
  seoGuidePath,
  seoTemplatePath,
  type SeoRoute,
} from '@/features/seo';

import type { SeoCtaClick, SeoLocaleChange } from './model/types';

import { type Locale } from '../../infrastructure/i18n/config';
import { t } from '../../infrastructure/i18n/utils';
import { CreateLink } from './components/SeoCta';
import { SeoFooter } from './components/SeoFooter';
import { SeoHeader } from './components/SeoHeader';
import { SeoShell } from './components/SeoShell';

export const SeoGuidePage = ({
  locale,
  route,
  onCtaClick,
  onLocaleChange,
}: {
  locale: Locale;
  route: Extract<SeoRoute, { kind: 'guide' }>;
  onCtaClick?: SeoCtaClick;
  onLocaleChange?: SeoLocaleChange;
}) => {
  const guide = SEO_GUIDE_CATALOG.find((item) => item.slug === route.guideSlug);

  if (!guide) return null;

  const copy = SEO_GUIDE_COPY[locale][guide.key];
  const relatedGuide = SEO_GUIDE_CATALOG.find(
    (item) => item.slug === 'how-to-print-a-name-keychain',
  );
  const nameKeychainTemplate = SEO_TEMPLATE_CATALOG.find((item) => item.id === 'name-keychain');
  const relatedResources =
    guide.slug === 'stl-vs-3mf' && relatedGuide && nameKeychainTemplate
      ? [
          {
            to: seoGuidePath(locale, relatedGuide),
            label: SEO_GUIDE_COPY[locale][relatedGuide.key].heading,
          },
          {
            to: seoTemplatePath(locale, nameKeychainTemplate),
            label: t(locale, 'seo.templates.nameKeychain.heading'),
          },
        ]
      : [];

  return (
    <SeoShell>
      <SeoHeader locale={locale} route={route} onLocaleChange={onLocaleChange} />
      <main className="seo-main seo-guide">
        <h1>{copy.heading}</h1>
        <p className="seo-lede">{copy.intro}</p>
        {copy.comparison && (
          <section className="seo-comparison" aria-labelledby="seo-comparison-title">
            <h2 id="seo-comparison-title">{copy.comparison.heading}</h2>
            <table>
              <thead>
                <tr>
                  {copy.comparison.headers.map((header) => (
                    <th key={header} scope="col">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {copy.comparison.rows.map(([format, contents, check]) => (
                  <tr key={format}>
                    <th scope="row">{format}</th>
                    <td>{contents}</td>
                    <td>{check}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        {copy.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
          </section>
        ))}
        {relatedResources.length > 0 && (
          <nav
            className="seo-guide-related"
            aria-label={t(locale, 'seo.navigation.relatedResources')}
          >
            <h2>{t(locale, 'seo.navigation.relatedResources')}</h2>
            <ul className="seo-feature-list">
              {relatedResources.map((resource) => (
                <li className="seo-feature-card" key={resource.to}>
                  <Link className="seo-related-link" to={resource.to}>
                    {resource.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <CreateLink locale={locale} onCtaClick={onCtaClick} cta="create">
          {t(locale, 'seo.home.cta')}
        </CreateLink>
      </main>
      <SeoFooter locale={locale} />
    </SeoShell>
  );
};

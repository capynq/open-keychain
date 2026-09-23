import { Link } from 'react-router';

import {
  SEO_GUIDE_CATALOG,
  SEO_GUIDE_COPY,
  SEO_TEMPLATE_CATALOG,
  seoGuidePath,
  type SeoRoute,
} from '@/features/seo';
import { templateCreatePath } from '@/shared/lib/create-path';

import type { Faq, SeoCtaClick, SeoLocaleChange } from './model/types';

import { type Locale } from '../../infrastructure/i18n/config';
import { t } from '../../infrastructure/i18n/utils';
import { FaqList } from './components/FaqList';
import { SeoFooter } from './components/SeoFooter';
import { SeoHeader } from './components/SeoHeader';
import { SeoShell } from './components/SeoShell';
import { localizedObjects, templateTranslationKey } from './lib/translation';

export const SeoTemplatePage = ({
  locale,
  route,
  onCtaClick,
  onLocaleChange,
}: {
  locale: Locale;
  route: Extract<SeoRoute, { kind: 'template' }>;
  onCtaClick?: SeoCtaClick;
  onLocaleChange?: SeoLocaleChange;
}) => {
  const template = SEO_TEMPLATE_CATALOG.find((item) => item.id === route.templateId);

  if (!template) return null;

  const prefix = `seo.templates.${templateTranslationKey(template.id)}`;
  const benefits = localizedObjects<string>(locale, `${prefix}.benefits`);
  const faq = localizedObjects<Faq>(locale, `${prefix}.faq`);
  const relatedGuideSlugs =
    template.id === 'name-keychain'
      ? ['how-to-print-a-name-keychain', 'stl-vs-3mf']
      : template.id === 'nameplate'
        ? ['stl-vs-3mf']
        : [];

  const relatedGuides = relatedGuideSlugs.flatMap((slug) => {
    const guide = SEO_GUIDE_CATALOG.find((item) => item.slug === slug);

    return guide ? [{ guide, path: seoGuidePath(locale, guide) }] : [];
  });

  return (
    <SeoShell>
      <SeoHeader locale={locale} route={route} onLocaleChange={onLocaleChange} />
      <main className="seo-main seo-template-page">
        <p className="seo-eyebrow">{t(locale, 'seo.navigation.templates')}</p>
        <h1>{t(locale, `${prefix}.heading`)}</h1>
        <p className="seo-lede">{t(locale, `${prefix}.intro`)}</p>
        <img
          src={template.previewSrc}
          alt={t(locale, `${prefix}.heading`)}
          width={640}
          height={360}
        />
        <p>
          <Link
            className="seo-cta"
            to={templateCreatePath(locale, template.id)}
            onClick={() => onCtaClick?.(locale, template.id)}
          >
            {t(locale, 'seo.home.cta')}
          </Link>
        </p>
        <h2>{t(locale, 'seo.home.templatesHeading')}</h2>
        <ul className="seo-feature-list">
          {benefits.map((benefit) => (
            <li className="seo-feature-card" key={benefit}>
              {benefit}
            </li>
          ))}
        </ul>
        <h2>{t(locale, 'seo.home.faqHeading')}</h2>
        <FaqList items={faq} />
        {relatedGuides.length > 0 && (
          <nav
            className="seo-template-related"
            aria-label={t(locale, 'seo.navigation.relatedResources')}
          >
            <h2>{t(locale, 'seo.navigation.relatedResources')}</h2>
            <ul className="seo-feature-list">
              {relatedGuides.map(({ guide, path }) => (
                <li className="seo-feature-card" key={path}>
                  <Link className="seo-related-link" to={path}>
                    {SEO_GUIDE_COPY[locale][guide.key].heading}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </main>
      <SeoFooter locale={locale} />
    </SeoShell>
  );
};

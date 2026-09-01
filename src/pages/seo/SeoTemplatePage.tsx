import { Link } from 'react-router';
import { t, type Locale } from '../../infrastructure/i18n';
import { SEO_TEMPLATE_CATALOG, type SeoRoute } from '@/features/seo';
import { templateCreatePath } from '@/shared/lib/create-path';
import { FaqList, SeoFooter, SeoHeader, SeoShell } from './components';
import type { Faq, SeoCtaClick, SeoLocaleChange } from './model';
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
        <ul>
          {benefits.map((benefit) => (
            <li key={benefit}>{benefit}</li>
          ))}
        </ul>
        <h2>{t(locale, 'seo.home.faqHeading')}</h2>
        <FaqList items={faq} />
      </main>
      <SeoFooter locale={locale} />
    </SeoShell>
  );
};

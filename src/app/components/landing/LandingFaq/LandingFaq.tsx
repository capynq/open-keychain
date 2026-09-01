import { Link } from 'react-router';

import {
  SEO_GUIDE_CATALOG,
  SEO_TEMPLATE_CATALOG,
  seoGuidePath,
  seoGuidesPath,
  seoTemplatePath,
  seoTemplatesPath,
  SEO_GUIDE_COPY,
  SEO_HUB_COPY,
} from '@/features/seo';
import { t, type Locale } from '@/infrastructure/i18n';
import i18n from '@/infrastructure/i18n/config';

import styles from './LandingFaq.module.css';
import '../../../../shared/styles/seo-links.css';

type Faq = { question: string; answer: string };

export const LandingFaq = ({ locale }: { locale: Locale }) => {
  const items = i18n.getFixedT(locale, 'translation')('seo.home.faq', {
    returnObjects: true,
  }) as unknown;

  const faq = Array.isArray(items) ? (items as Faq[]) : [];

  return (
    <section
      className={`${styles.root} landing-section landing-faq`}
      id="faq"
      aria-labelledby="landing-faq-title"
    >
      <h2 id="landing-faq-title">{i18n.getFixedT(locale, 'translation')('seo.home.faqHeading')}</h2>
      <div className={styles.list}>
        {faq.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
      <nav className={styles.resources} aria-label={SEO_HUB_COPY[locale].heading}>
        <h3>{t(locale, 'landing.resourcesTitle')}</h3>
        <ul className={`${styles.resourceList} seo-resource-list`}>
          <li className="seo-resource-card">
            <Link to={seoTemplatesPath(locale)}>{t(locale, 'seo.navigation.templates')}</Link>
          </li>
          <li className="seo-resource-card">
            <Link to={seoGuidesPath(locale)}>{SEO_HUB_COPY[locale].heading}</Link>
          </li>
          {SEO_TEMPLATE_CATALOG.map((template) => (
            <li className="seo-resource-card" key={template.id}>
              <Link to={seoTemplatePath(locale, template)}>
                {t(locale, `seo.templates.${template.key}.heading`)}
              </Link>
            </li>
          ))}
          {SEO_GUIDE_CATALOG.map((guide) => (
            <li className="seo-resource-card" key={guide.slug}>
              <Link to={seoGuidePath(locale, guide)}>
                {SEO_GUIDE_COPY[locale][guide.key].heading}
              </Link>
            </li>
          ))}
          <li className="seo-resource-card">
            <Link to="/privacy">{t(locale, 'seo.navigation.privacy')}</Link>
          </li>
        </ul>
      </nav>
    </section>
  );
};

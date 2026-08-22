import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import en from '../src/infrastructure/i18n/locales/en.json';
import ru from '../src/infrastructure/i18n/locales/ru.json';
import uk from '../src/infrastructure/i18n/locales/uk.json';
import {
  SEO_LOCALES,
  SEO_PAGE_MANIFEST,
  SEO_TEMPLATE_CATALOG,
  seoHomePath,
  seoTemplatePath,
  seoTemplatesPath,
  seoGuidesPath,
  seoGuidePath,
  SEO_GUIDE_CATALOG,
  type SeoLocale,
  type SeoTemplateDefinition,
} from '../src/infrastructure/seo/catalog';
import { SEO_GUIDE_COPY, SEO_HUB_COPY } from '../src/infrastructure/seo/guides';
import type { SeoGuideCopy } from '../src/infrastructure/seo/guides';

const SITE_URL = 'https://open-keychain.com';
const POSTHOG_KEY = process.env.VITE_POSTHOG_KEY ?? '';
const POSTHOG_HOST = process.env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(ROOT_DIR, '../dist');
const LOCALE_DOCUMENTS = { en, ru, uk } as const;

type Faq = { question: string; answer: string };
type TemplateCopy = {
  title: string;
  description: string;
  heading: string;
  intro: string;
  benefits: string[];
  faq: Faq[];
};
type SeoCopy = {
  brand: string;
  languageLabel: string;
  home: {
    title: string;
    description: string;
    heading: string;
    intro: string;
    cta: string;
    templatesHeading: string;
    templatesBody: string;
    workflowHeading: string;
    workflowBody: string;
    privacyHeading: string;
    privacyBody: string;
    faqHeading: string;
    faq: Faq[];
  };
  templates: Record<SeoTemplateDefinition['key'], TemplateCopy>;
  navigation: {
    home: string;
    templates: string;
    howItWorks: string;
    github: string;
    privacy: string;
    readMore: string;
  };
  templatesHub: { title: string; description: string; heading: string; intro: string };
  guidesHub: { title: string; description: string; heading: string; intro: string };
  guides: Record<string, SeoGuideCopy>;
};

const documents = LOCALE_DOCUMENTS as unknown as Record<SeoLocale, { seo: SeoCopy }>;
const brandFirstTitle = (brand: string, purpose: string): string =>
  purpose.startsWith(`${brand} | `) ? purpose : `${brand} | ${purpose}`;

for (const locale of SEO_LOCALES) {
  documents[locale].seo.templatesHub = {
    title: brandFirstTitle(documents[locale].seo.brand, documents[locale].seo.navigation.templates),
    description: documents[locale].seo.home.templatesBody,
    heading: documents[locale].seo.home.templatesHeading,
    intro: documents[locale].seo.home.templatesBody,
  };
  documents[locale].seo.guidesHub = SEO_HUB_COPY[locale];
  documents[locale].seo.guides = SEO_GUIDE_COPY[locale];
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const escapeJson = (value: unknown): string =>
  (JSON.stringify(value) ?? '').replaceAll('<', '\\u003c').replaceAll('>', '\\u003e');

const ROOT_PLACEHOLDER = '<div id="root"><!-- seo-fallback --></div>';

const absoluteUrl = (urlPath: string): string => `${SITE_URL}${urlPath}`;

type SeoKind = 'home' | 'templates' | 'template' | 'guides' | 'guide';
const alternateLinks = (
  kind: SeoKind,
  template?: SeoTemplateDefinition,
  guideSlug?: string,
): string => {
  const links = SEO_LOCALES.map((locale) => {
    const urlPath =
      kind === 'home'
        ? seoHomePath(locale)
        : kind === 'templates'
          ? seoTemplatesPath(locale)
          : kind === 'guides'
            ? seoGuidesPath(locale)
            : kind === 'template'
              ? seoTemplatePath(locale, template!)
              : seoGuidePath(
                  locale,
                  SEO_GUIDE_CATALOG.find((g) => g.slug === guideSlug)!,
                );
    return `<link rel="alternate" hreflang="${locale}" href="${absoluteUrl(urlPath)}" />`;
  });
  const fallbackPath =
    kind === 'home'
      ? seoHomePath('en')
      : kind === 'templates'
        ? seoTemplatesPath('en')
        : kind === 'guides'
          ? seoGuidesPath('en')
          : kind === 'template'
            ? seoTemplatePath('en', template!)
            : seoGuidePath(
                'en',
                SEO_GUIDE_CATALOG.find((g) => g.slug === guideSlug)!,
              );
  links.push(`<link rel="alternate" hreflang="x-default" href="${absoluteUrl(fallbackPath)}" />`);
  return links.join('\n    ');
};

const imageAlt = (locale: SeoLocale, template: SeoTemplateDefinition): string => {
  const copy = documents[locale].seo.templates[template.key];
  return `${copy.heading} ALEX preview`;
};

const languageLinks = (
  locale: SeoLocale,
  kind: SeoKind,
  template?: SeoTemplateDefinition,
  guideSlug?: string,
) =>
  SEO_LOCALES.map((nextLocale) => {
    const nativeLabel = { en: 'English', ru: 'Русский', uk: 'Українська' }[nextLocale];
    const urlPath =
      kind === 'home'
        ? seoHomePath(nextLocale)
        : kind === 'templates'
          ? seoTemplatesPath(nextLocale)
          : kind === 'guides'
            ? seoGuidesPath(nextLocale)
            : kind === 'template'
              ? seoTemplatePath(nextLocale, template!)
              : seoGuidePath(
                  nextLocale,
                  SEO_GUIDE_CATALOG.find((g) => g.slug === guideSlug)!,
                );
    return `<a href="${urlPath}" data-analytics-event="seo_language_changed" data-analytics-cta="${nextLocale}"${nextLocale === locale ? ' aria-current="page"' : ''}>${nativeLabel}</a>`;
  }).join(' · ');

const templateLinks = (locale: SeoLocale, current?: SeoTemplateDefinition): string =>
  SEO_TEMPLATE_CATALOG.map((template) => {
    const copy = documents[locale].seo.templates[template.key];
    const pathName = seoTemplatePath(locale, template);
    const currentAttribute = current?.id === template.id ? ' aria-current="page"' : '';
    return `<li><a href="${pathName}" data-analytics-event="seo_cta_clicked" data-analytics-cta="${template.id}"${currentAttribute}>${escapeHtml(copy.heading)}</a></li>`;
  }).join('\n');

const guideTemplateId = (guideKey: string): SeoTemplateDefinition['id'] =>
  guideKey === 'articulatedPrinting'
    ? 'articulated-name'
    : guideKey === 'plantLabelPrinting'
      ? 'plant-label'
      : 'name-keychain';

const guideFaq = (locale: SeoLocale, guideCopy: SeoGuideCopy): readonly Faq[] =>
  guideCopy.faq ?? [
    {
      question:
        locale === 'ru'
          ? 'Что проверить перед печатью?'
          : locale === 'uk'
            ? 'Що перевірити перед друком?'
            : 'What should you check before printing?',
      answer: guideCopy.sections[0]?.body ?? guideCopy.intro,
    },
  ];

const guideLinks = (locale: SeoLocale, template: SeoTemplateDefinition): string =>
  SEO_GUIDE_CATALOG.filter((guide) => guideTemplateId(guide.key) === template.id)
    .map(
      (guide) =>
        `<li><a href="${seoGuidePath(locale, guide)}">${escapeHtml(documents[locale].seo.guides[guide.key].heading)}</a></li>`,
    )
    .join('\n');

const jsonLdForHome = (locale: SeoLocale, title: string, description: string) => {
  const pageUrl = absoluteUrl(seoHomePath(locale));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: documents[locale].seo.brand,
        url: SITE_URL,
        sameAs: ['https://github.com/capynq/open-keychain'],
      },
      {
        '@type': 'WebSite',
        '@id': `${pageUrl}#website`,
        name: documents[locale].seo.brand,
        url: pageUrl,
        inLanguage: locale,
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: title,
        description,
        inLanguage: locale,
        isPartOf: { '@id': `${pageUrl}#website` },
      },
      {
        '@type': 'WebApplication',
        '@id': `${pageUrl}#application`,
        name: documents[locale].seo.brand,
        url: pageUrl,
        description,
        applicationCategory: 'DesignApplication',
        operatingSystem: 'Web',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        publisher: { '@id': `${SITE_URL}/#organization` },
        isPartOf: { '@id': `${pageUrl}#website` },
        inLanguage: locale,
        headline: title,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: documents[locale].seo.navigation.home,
            item: pageUrl,
          },
        ],
      },
    ],
  };
};

const jsonLdForTemplate = (
  locale: SeoLocale,
  template: SeoTemplateDefinition,
  title: string,
  description: string,
) => {
  const pageUrl = absoluteUrl(seoTemplatePath(locale, template));
  const homeUrl = absoluteUrl(seoHomePath(locale));
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: documents[locale].seo.brand,
        url: SITE_URL,
        sameAs: ['https://github.com/capynq/open-keychain'],
      },
      {
        '@type': 'WebSite',
        '@id': `${homeUrl}#website`,
        name: documents[locale].seo.brand,
        url: homeUrl,
        inLanguage: locale,
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: title,
        description,
        inLanguage: locale,
        isPartOf: { '@id': `${homeUrl}#website` },
      },
      {
        '@type': 'WebApplication',
        '@id': `${pageUrl}#application`,
        name: documents[locale].seo.brand,
        url: pageUrl,
        description,
        applicationCategory: 'DesignApplication',
        operatingSystem: 'Web',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        inLanguage: locale,
        headline: title,
        image: absoluteUrl(template.previewSrc),
        publisher: { '@id': `${SITE_URL}/#organization` },
        isPartOf: { '@id': `${homeUrl}#website` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${pageUrl}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: documents[locale].seo.navigation.home,
            item: homeUrl,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: documents[locale].seo.navigation.templates,
            item: absoluteUrl(seoTemplatesPath(locale)),
          },
          { '@type': 'ListItem', position: 3, name: title, item: pageUrl },
        ],
      },
    ],
  };
};

const renderFaq = (faq: readonly Faq[]): string =>
  faq
    .map(
      ({ question, answer }) =>
        `<details class="seo-faq-item"><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`,
    )
    .join('\n');

const jsonLdForArticle = (
  locale: SeoLocale,
  title: string,
  description: string,
  pageUrl: string,
  lastModified: string,
) => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: documents[locale].seo.brand,
      url: SITE_URL,
      sameAs: ['https://github.com/capynq/open-keychain'],
    },
    {
      '@type': 'WebSite',
      '@id': `${absoluteUrl(seoHomePath(locale))}#website`,
      name: documents[locale].seo.brand,
      url: absoluteUrl(seoHomePath(locale)),
      inLanguage: locale,
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
    {
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: title,
      description,
      inLanguage: locale,
      isPartOf: { '@id': `${absoluteUrl(seoHomePath(locale))}#website` },
    },
    {
      '@type': 'Article',
      '@id': `${pageUrl}#article`,
      headline: title,
      name: title,
      url: pageUrl,
      description,
      inLanguage: locale,
      author: { '@id': `${SITE_URL}/#organization` },
      publisher: { '@id': `${SITE_URL}/#organization` },
      isPartOf: { '@id': `${absoluteUrl(seoHomePath(locale))}#website` },
      dateModified: lastModified,
    },
    {
      '@type': 'WebApplication',
      '@id': `${pageUrl}#application`,
      name: documents[locale].seo.brand,
      url: pageUrl,
      description,
      applicationCategory: 'DesignApplication',
      operatingSystem: 'Web',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@id': `${SITE_URL}/#organization` },
      isPartOf: { '@id': `${absoluteUrl(seoHomePath(locale))}#website` },
      inLanguage: locale,
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${pageUrl}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: documents[locale].seo.navigation.home,
          item: absoluteUrl(seoHomePath(locale)),
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: documents[locale].seo.guidesHub.heading,
          item: absoluteUrl(seoGuidesPath(locale)),
        },
        { '@type': 'ListItem', position: 3, name: title, item: pageUrl },
      ],
    },
  ],
});

const renderHeader = (
  locale: SeoLocale,
  kind: SeoKind,
  template?: SeoTemplateDefinition,
  guideSlug?: string,
): string => {
  const copy = documents[locale].seo;
  return `<header class="seo-header">
    <a class="seo-brand" href="${seoHomePath(locale)}">${escapeHtml(copy.navigation.home)}</a>
    <nav aria-label="${escapeHtml(copy.navigation.templates)}">
      <a href="${seoTemplatesPath(locale)}">${escapeHtml(copy.navigation.templates)}</a>
      <a href="${seoGuidesPath(locale)}">${escapeHtml(copy.guidesHub.heading)}</a>
      <a href="${seoHomePath(locale)}#how-it-works">${escapeHtml(copy.navigation.howItWorks)}</a>
      <a href="https://github.com/capynq/open-keychain">${escapeHtml(copy.navigation.github)}</a>
    </nav>
    <div class="seo-language" aria-label="${escapeHtml(copy.languageLabel)}">${languageLinks(locale, kind, template, guideSlug)}</div>
  </header>`;
};

const renderFooter = (locale: SeoLocale): string => {
  const copy = documents[locale].seo;
  return `<footer class="seo-footer">
    <span>${escapeHtml(copy.brand)} · MIT licensed</span>
    <a href="/privacy.html">${escapeHtml(copy.navigation.privacy)}</a>
  </footer>`;
};

const renderHomeMarkup = (locale: SeoLocale): string => {
  const copy = documents[locale].seo;
  const templateCards = SEO_TEMPLATE_CATALOG.map((template) => {
    const templateCopy = copy.templates[template.key];
    return `<article class="seo-template-card">
      <img src="${template.previewSrc}" alt="${escapeHtml(imageAlt(locale, template))}" width="640" height="360" loading="lazy" />
      <h3>${escapeHtml(templateCopy.heading)}</h3>
      <p>${escapeHtml(templateCopy.intro)}</p>
      <a class="seo-text-link" data-analytics-event="seo_cta_clicked" data-analytics-cta="${template.id}" href="${seoTemplatePath(locale, template)}">${escapeHtml(copy.navigation.readMore)} →</a>
    </article>`;
  }).join('\n');
  return `<main class="seo-main seo-home">
    <section class="seo-hero" aria-labelledby="seo-home-heading">
      <div>
        <p class="seo-eyebrow">${escapeHtml(copy.brand)}</p>
        <h1 id="seo-home-heading">${escapeHtml(copy.home.heading)}</h1>
        <p class="seo-lede">${escapeHtml(copy.home.intro)}</p>
        <a class="seo-cta" data-analytics-event="seo_cta_clicked" href="/create?lang=${locale}">${escapeHtml(copy.home.cta)} <span aria-hidden="true">→</span></a>
      </div>
      <img class="seo-hero-image" src="/showcase/create-desktop.png" alt="${escapeHtml(copy.home.heading)}" width="1440" height="900" fetchpriority="high" />
    </section>
    <section class="seo-section" id="templates" aria-labelledby="seo-templates-heading">
      <p class="seo-eyebrow">${escapeHtml(copy.navigation.templates)}</p>
      <h2 id="seo-templates-heading">${escapeHtml(copy.home.templatesHeading)}</h2>
      <p class="seo-section-lede">${escapeHtml(copy.home.templatesBody)}</p>
      <div class="seo-template-grid">${templateCards}</div>
    </section>
    <section class="seo-section seo-split" id="how-it-works" aria-labelledby="seo-workflow-heading">
      <div><p class="seo-eyebrow">${escapeHtml(copy.home.workflowHeading)}</p><h2 id="seo-workflow-heading">${escapeHtml(copy.home.workflowHeading)}</h2></div>
      <p>${escapeHtml(copy.home.workflowBody)}</p>
    </section>
    <section class="seo-section seo-split" aria-labelledby="seo-privacy-heading">
      <div><p class="seo-eyebrow">${escapeHtml(copy.home.privacyHeading)}</p><h2 id="seo-privacy-heading">${escapeHtml(copy.home.privacyHeading)}</h2></div>
      <p>${escapeHtml(copy.home.privacyBody)}</p>
    </section>
    <section class="seo-section" aria-labelledby="seo-faq-heading">
      <h2 id="seo-faq-heading">${escapeHtml(copy.home.faqHeading)}</h2>
      <div class="seo-faq">${renderFaq(copy.home.faq)}</div>
    </section>
  </main>`;
};

const renderTemplateMarkup = (locale: SeoLocale, template: SeoTemplateDefinition): string => {
  const copy = documents[locale].seo;
  const templateCopy = copy.templates[template.key];
  const benefits = templateCopy.benefits
    .map((benefit) => `<li>${escapeHtml(benefit)}</li>`)
    .join('');
  return `<main class="seo-main seo-template-page">
    <nav class="seo-breadcrumbs" aria-label="Breadcrumb"><a href="${seoHomePath(locale)}">${escapeHtml(copy.navigation.home)}</a><span aria-hidden="true">/</span><a href="${seoTemplatesPath(locale)}">${escapeHtml(copy.navigation.templates)}</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(templateCopy.heading)}</span></nav>
    <section class="seo-template-hero" aria-labelledby="seo-template-heading">
      <div>
        <p class="seo-eyebrow">${escapeHtml(copy.navigation.templates)}</p>
        <h1 id="seo-template-heading">${escapeHtml(templateCopy.heading)}</h1>
        <p class="seo-lede">${escapeHtml(templateCopy.intro)}</p>
        <a class="seo-cta" data-analytics-event="seo_cta_clicked" href="/create?template=${encodeURIComponent(template.id)}&amp;lang=${locale}">${escapeHtml(copy.home.cta)} <span aria-hidden="true">→</span></a>
      </div>
      <img class="seo-hero-image" src="${template.previewSrc}" alt="${escapeHtml(imageAlt(locale, template))}" width="640" height="360" fetchpriority="high" />
    </section>
    <section class="seo-section seo-benefits" aria-labelledby="seo-benefits-heading">
      <h2 id="seo-benefits-heading">${escapeHtml(copy.home.templatesHeading)}</h2>
      <ul>${benefits}</ul>
    </section>
    <section class="seo-section" aria-labelledby="seo-faq-heading">
      <h2 id="seo-faq-heading">${escapeHtml(copy.home.faqHeading)}</h2>
      <div class="seo-faq">${renderFaq(templateCopy.faq)}</div>
    </section>
    <section class="seo-section seo-related" aria-labelledby="seo-related-heading">
      <h2 id="seo-related-heading">${escapeHtml(copy.navigation.templates)}</h2>
      <ul>${templateLinks(locale, template)}</ul>
    </section>
    <section class="seo-section seo-related" aria-labelledby="seo-guides-heading">
      <h2 id="seo-guides-heading">${escapeHtml(copy.guidesHub.heading)}</h2>
      <ul>${guideLinks(locale, template)}</ul>
    </section>
  </main>`;
};

const renderHubMarkup = (locale: SeoLocale, kind: 'templates' | 'guides'): string => {
  const copy = documents[locale].seo;
  const hub = kind === 'templates' ? copy.templatesHub : copy.guidesHub;
  const cards =
    kind === 'templates'
      ? SEO_TEMPLATE_CATALOG.map(
          (template) =>
            `<li><a href="${seoTemplatePath(locale, template)}" data-analytics-event="seo_cta_clicked" data-analytics-cta="${template.id}">${escapeHtml(copy.templates[template.key].heading)}</a><p>${escapeHtml(copy.templates[template.key].intro)}</p></li>`,
        ).join('\n')
      : SEO_GUIDE_CATALOG.map(
          (guide) =>
            `<li><a href="${seoGuidePath(locale, guide)}" data-analytics-event="seo_cta_clicked" data-analytics-cta="${guide.slug}">${escapeHtml(copy.guides[guide.key].heading)}</a><p>${escapeHtml(copy.guides[guide.key].intro)}</p></li>`,
        ).join('\n');
  return `<main class="seo-main seo-hub"><nav class="seo-breadcrumbs"><a href="${seoHomePath(locale)}">${escapeHtml(copy.navigation.home)}</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(hub.heading)}</span></nav><section class="seo-section"><p class="seo-eyebrow">${escapeHtml(kind === 'templates' ? copy.navigation.templates : copy.guidesHub.heading)}</p><h1>${escapeHtml(hub.heading)}</h1><p class="seo-lede">${escapeHtml(hub.intro)}</p><ul class="seo-hub-list">${cards}</ul><a class="seo-cta" data-analytics-event="seo_cta_clicked" data-analytics-cta="create" href="/create?lang=${locale}">${escapeHtml(copy.home.cta)} <span aria-hidden="true">→</span></a></section></main>`;
};

const renderGuideMarkup = (locale: SeoLocale, guideSlug: string): string => {
  const copy = documents[locale].seo;
  const guide = SEO_GUIDE_CATALOG.find((item) => item.slug === guideSlug)!;
  const guideCopy = copy.guides[guide.key];
  const updatedLabel = locale === 'ru' ? 'Обновлено' : locale === 'uk' ? 'Оновлено' : 'Updated';
  const relatedTemplate = SEO_TEMPLATE_CATALOG.find(
    (template) => template.id === guideTemplateId(guide.key),
  )!;
  return `<main class="seo-main seo-guide"><nav class="seo-breadcrumbs"><a href="${seoHomePath(locale)}">${escapeHtml(copy.navigation.home)}</a><span aria-hidden="true">/</span><a href="${seoGuidesPath(locale)}">${escapeHtml(copy.guidesHub.heading)}</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(guideCopy.heading)}</span></nav><article class="seo-section"><p class="seo-eyebrow">${escapeHtml(copy.guidesHub.heading)}</p><h1>${escapeHtml(guideCopy.heading)}</h1><p class="seo-lede">${escapeHtml(guideCopy.intro)}</p><p class="seo-byline">${escapeHtml(copy.brand)} · <time datetime="${guide.lastModified}">${escapeHtml(updatedLabel)} ${guide.lastModified}</time></p><img class="seo-guide-image" src="${relatedTemplate.previewSrc}" alt="${escapeHtml(imageAlt(locale, relatedTemplate))}" width="640" height="360" loading="lazy" />${guideCopy.sections.map((section) => `<section><h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(section.body)}</p></section>`).join('')}<section class="seo-section"><h2>${escapeHtml(copy.home.faqHeading)}</h2><div class="seo-faq">${renderFaq(guideFaq(locale, guideCopy))}</div></section><p><a class="seo-text-link" data-analytics-event="seo_cta_clicked" data-analytics-cta="${relatedTemplate.id}" href="${seoTemplatePath(locale, relatedTemplate)}">${escapeHtml(copy.templates[relatedTemplate.key].heading)} →</a></p><a class="seo-cta" data-analytics-event="seo_cta_clicked" data-analytics-cta="create" href="/create?template=${encodeURIComponent(relatedTemplate.id)}&amp;lang=${locale}">${escapeHtml(copy.home.cta)} <span aria-hidden="true">→</span></a></article></main>`;
};

const renderPage = (
  locale: SeoLocale,
  kind: SeoKind,
  template?: SeoTemplateDefinition,
  guideSlug?: string,
  lastModified = '2026-08-20',
): string => {
  const copy = documents[locale].seo;
  const isHome = kind === 'home';
  const pagePath =
    kind === 'home'
      ? seoHomePath(locale)
      : kind === 'templates'
        ? seoTemplatesPath(locale)
        : kind === 'guides'
          ? seoGuidesPath(locale)
          : kind === 'template'
            ? seoTemplatePath(locale, template!)
            : seoGuidePath(
                locale,
                SEO_GUIDE_CATALOG.find((g) => g.slug === guideSlug)!,
              );

  const jsonLdForHub = (
    locale: SeoLocale,
    kind: 'templates' | 'guides',
    title: string,
    description: string,
  ) => {
    const pageUrl = absoluteUrl(
      kind === 'templates' ? seoTemplatesPath(locale) : seoGuidesPath(locale),
    );
    const homeUrl = absoluteUrl(seoHomePath(locale));
    const hubName =
      kind === 'templates'
        ? documents[locale].seo.navigation.templates
        : documents[locale].seo.guidesHub.heading;
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${SITE_URL}/#organization`,
          name: documents[locale].seo.brand,
          url: SITE_URL,
          sameAs: ['https://github.com/capynq/open-keychain'],
        },
        {
          '@type': 'WebSite',
          '@id': `${homeUrl}#website`,
          name: documents[locale].seo.brand,
          url: homeUrl,
          inLanguage: locale,
          publisher: { '@id': `${SITE_URL}/#organization` },
        },
        {
          '@type': 'WebPage',
          '@id': `${pageUrl}#webpage`,
          url: pageUrl,
          name: title,
          description,
          inLanguage: locale,
          isPartOf: { '@id': `${homeUrl}#website` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${pageUrl}#breadcrumb`,
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: documents[locale].seo.navigation.home,
              item: homeUrl,
            },
            { '@type': 'ListItem', position: 2, name: hubName, item: pageUrl },
          ],
        },
      ],
    };
  };
  const guideCopy = guideSlug
    ? copy.guides[SEO_GUIDE_CATALOG.find((g) => g.slug === guideSlug)!.key]
    : undefined;
  const title = brandFirstTitle(
    copy.brand,
    isHome
      ? copy.home.title
      : kind === 'templates'
        ? copy.templatesHub.title
        : kind === 'guides'
          ? copy.guidesHub.title
          : kind === 'template'
            ? copy.templates[template!.key].title
            : guideCopy!.title,
  );
  const description = isHome
    ? copy.home.description
    : kind === 'templates'
      ? copy.templatesHub.description
      : kind === 'guides'
        ? copy.guidesHub.description
        : kind === 'template'
          ? copy.templates[template!.key].description
          : guideCopy!.description;
  const jsonLd = isHome
    ? jsonLdForHome(locale, title, description)
    : kind === 'template'
      ? jsonLdForTemplate(locale, template!, title, description)
      : kind === 'templates' || kind === 'guides'
        ? jsonLdForHub(locale, kind, title, description)
        : jsonLdForArticle(locale, title, description, absoluteUrl(pagePath), lastModified);
  const image = isHome
    ? '/brand/open-keychain-og.png'
    : kind === 'template'
      ? template!.previewSrc
      : kind === 'guide'
        ? SEO_TEMPLATE_CATALOG.find(
            (candidate) =>
              candidate.id ===
              guideTemplateId(SEO_GUIDE_CATALOG.find((g) => g.slug === guideSlug)!.key),
          )!.previewSrc
        : '/brand/open-keychain-og.png';
  const imageDimensions = isHome ? { width: 1200, height: 630 } : { width: 640, height: 360 };
  const markup = isHome
    ? renderHomeMarkup(locale)
    : kind === 'template'
      ? renderTemplateMarkup(locale, template!)
      : kind === 'guide'
        ? renderGuideMarkup(locale, guideSlug!)
        : renderHubMarkup(locale, kind);
  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#f6f4ef" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="${absoluteUrl(pagePath)}" />
    ${alternateLinks(kind, template, guideSlug)}
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${escapeHtml(copy.brand)}" />
    <meta property="og:url" content="${absoluteUrl(pagePath)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${absoluteUrl(image)}" />
    <meta property="og:image:width" content="${imageDimensions.width}" />
    <meta property="og:image:height" content="${imageDimensions.height}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${absoluteUrl(image)}" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="icon" href="/brand/favicon-96.png" sizes="96x96" type="image/png" />
    <link rel="stylesheet" href="/seo.css" />
    <script src="/seo-analytics.js" defer data-key="${escapeHtml(POSTHOG_KEY)}" data-host="${escapeHtml(POSTHOG_HOST)}" data-page-type="${kind}" data-page-id="${escapeHtml(guideSlug ?? template?.id ?? (kind === 'home' ? 'home' : kind))}"></script>
    <title>${escapeHtml(title)}</title>
    <script type="application/ld+json">${escapeJson(jsonLd)}</script>
  </head>
  <body>
    ${renderHeader(locale, kind, template, guideSlug)}
    ${markup}
    ${renderFooter(locale)}
  </body>
</html>`;
};

const replaceHeadTag = (html: string, pattern: RegExp, replacement: string): string =>
  html.replace(pattern, replacement);

const createAppShell = (
  source: string,
  title: string,
  description: string,
  canonicalPath: string,
): string => {
  let html = source.replace(ROOT_PLACEHOLDER, '<div id="root"></div>');
  html = replaceHeadTag(html, /<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = replaceHeadTag(
    html,
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${escapeHtml(description)}" />`,
  );
  html = replaceHeadTag(
    html,
    /<meta name="robots" content="[^"]*" \/>/,
    '<meta name="robots" content="noindex,follow" />',
  );
  html = replaceHeadTag(
    html,
    /<link rel="canonical" href="[^"]*" \/>/,
    `<link rel="canonical" href="${absoluteUrl(canonicalPath)}" />`,
  );
  html = replaceHeadTag(
    html,
    /<meta property="og:url" content="[^"]*" \/>/,
    `<meta property="og:url" content="${absoluteUrl(canonicalPath)}" />`,
  );
  html = replaceHeadTag(
    html,
    /<meta property="og:title" content="[^"]*" \/>/,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
  );
  html = replaceHeadTag(
    html,
    /<meta property="og:description" content="[^"]*" \/>/,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
  );
  html = replaceHeadTag(
    html,
    /<meta name="twitter:title" content="[^"]*" \/>/,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
  );
  html = replaceHeadTag(
    html,
    /<meta name="twitter:description" content="[^"]*" \/>/,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
  );
  return html;
};

const writeFile = (filePath: string, contents: string): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
};

const main = (): void => {
  if (!fs.existsSync(DIST_DIR)) throw new Error(`Missing build directory: ${DIST_DIR}`);
  const sourceIndex = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8');
  const fallbackMarkup = renderHomeMarkup('en');
  let rootIndex = sourceIndex.replace(ROOT_PLACEHOLDER, `<div id="root">${fallbackMarkup}</div>`);
  rootIndex = replaceHeadTag(
    rootIndex,
    /<title>[\s\S]*?<\/title>/,
    `<title>${escapeHtml(documents.en.seo.home.title)}</title>`,
  );
  rootIndex = replaceHeadTag(
    rootIndex,
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${escapeHtml(documents.en.seo.home.description)}" />`,
  );
  if (!rootIndex.includes('hreflang="x-default"')) {
    rootIndex = rootIndex.replace('</head>', `    ${alternateLinks('home')}\n  </head>`);
  }
  const rootAnalytics = `<script src="/seo-analytics.js" defer data-key="${escapeHtml(POSTHOG_KEY)}" data-host="${escapeHtml(POSTHOG_HOST)}" data-page-type="home" data-page-id="home" data-spa="true"></script>`;
  if (!rootIndex.includes('src="/seo-analytics.js"')) {
    rootIndex = rootIndex.replace('</head>', `    ${rootAnalytics}\n  </head>`);
  }
  const rootJsonLd = `<script type="application/ld+json">${escapeJson(jsonLdForHome('en', documents.en.seo.home.title, documents.en.seo.home.description))}</script>`;
  if (/<script type="application\/ld\+json">[\s\S]*?<\/script>/.test(rootIndex)) {
    rootIndex = rootIndex.replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      rootJsonLd,
    );
  } else {
    rootIndex = rootIndex.replace('</head>', `    ${rootJsonLd}\n  </head>`);
  }
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), rootIndex);

  for (const entry of SEO_PAGE_MANIFEST) {
    if (entry.kind === 'home' && entry.locale === 'en') continue;
    const template =
      entry.kind === 'template'
        ? SEO_TEMPLATE_CATALOG.find((candidate) => candidate.id === entry.templateId)
        : undefined;
    if (entry.kind === 'template' && !template)
      throw new Error(`Unknown SEO template: ${entry.templateId}`);
    const html = renderPage(
      entry.locale,
      entry.kind,
      template,
      entry.kind === 'guide' ? entry.guideSlug : undefined,
      entry.lastModified,
    );
    writeFile(path.join(DIST_DIR, entry.path, 'index.html'), html);
  }

  const createTitle = 'Open Keychain 3D | Create a printable keychain';
  const createDescription =
    'Design a personalized printable keychain or label, preview the geometry, and export STL or 3MF locally.';
  const createShell = createAppShell(sourceIndex, createTitle, createDescription, '/create');
  const profileShell = createAppShell(
    sourceIndex,
    'Open Keychain 3D | Your projects',
    'Manage saved printable keychain projects.',
    '/profile',
  );
  writeFile(path.join(DIST_DIR, 'create/index.html'), createShell);
  writeFile(path.join(DIST_DIR, 'create.html'), createShell);
  writeFile(path.join(DIST_DIR, 'profile/index.html'), profileShell);
  writeFile(path.join(DIST_DIR, 'profile.html'), profileShell);

  const sitemapEntries = SEO_PAGE_MANIFEST.map((entry) => {
    const template =
      entry.kind === 'template'
        ? SEO_TEMPLATE_CATALOG.find((candidate) => candidate.id === entry.templateId)
        : undefined;
    const guide =
      entry.kind === 'guide'
        ? SEO_GUIDE_CATALOG.find((candidate) => candidate.slug === entry.guideSlug)
        : undefined;
    const image =
      template?.previewSrc ??
      (guide
        ? SEO_TEMPLATE_CATALOG.find((candidate) => candidate.id === guideTemplateId(guide.key))
            ?.previewSrc
        : '/brand/open-keychain-og.png') ??
      '/brand/open-keychain-og.png';
    return `  <url>\n    <loc>${absoluteUrl(entry.path)}</loc>\n    <lastmod>${entry.lastModified}</lastmod>\n    <image:image>\n      <image:loc>${absoluteUrl(image)}</image:loc>\n    </image:image>\n  </url>`;
  }).join('\n');
  writeFile(
    path.join(DIST_DIR, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${sitemapEntries}\n</urlset>\n`,
  );
  writeFile(
    path.join(DIST_DIR, '404.html'),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex,follow" />
    <link rel="stylesheet" href="/seo.css" />
    <title>Open Keychain 3D | Page not found</title>
  </head>
  <body>
    ${renderHeader('en', 'home')}
    <main class="seo-main"><section class="seo-section"><p class="seo-eyebrow">Open Keychain 3D</p><h1>Page not found</h1><p class="seo-lede">That page does not exist. Return to Open Keychain 3D to create a printable design.</p><a class="seo-cta" href="/">Open Keychain 3D</a></section></main>
    ${renderFooter('en')}
  </body>
</html>`,
  );
};

main();

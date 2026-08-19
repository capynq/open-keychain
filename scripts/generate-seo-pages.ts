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
  type SeoLocale,
  type SeoTemplateDefinition,
} from '../src/infrastructure/seo/catalog';

const SITE_URL = 'https://open-keychain.com';
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
};

const documents = LOCALE_DOCUMENTS as Record<SeoLocale, { seo: SeoCopy }>;

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

const alternateLinks = (kind: 'home' | 'template', template?: SeoTemplateDefinition): string => {
  const links = SEO_LOCALES.map((locale) => {
    const urlPath = kind === 'home' ? seoHomePath(locale) : seoTemplatePath(locale, template!);
    return `<link rel="alternate" hreflang="${locale}" href="${absoluteUrl(urlPath)}" />`;
  });
  const fallbackPath = kind === 'home' ? seoHomePath('en') : seoTemplatePath('en', template!);
  links.push(`<link rel="alternate" hreflang="x-default" href="${absoluteUrl(fallbackPath)}" />`);
  return links.join('\n    ');
};

const imageAlt = (locale: SeoLocale, template: SeoTemplateDefinition): string => {
  const copy = documents[locale].seo.templates[template.key];
  return `${copy.heading} ALEX preview`;
};

const languageLinks = (
  locale: SeoLocale,
  kind: 'home' | 'template',
  template?: SeoTemplateDefinition,
) =>
  SEO_LOCALES.map((nextLocale) => {
    const urlPath =
      kind === 'home' ? seoHomePath(nextLocale) : seoTemplatePath(nextLocale, template!);
    return `<a href="${urlPath}"${nextLocale === locale ? ' aria-current="page"' : ''}>${nextLocale.toUpperCase()}</a>`;
  }).join(' · ');

const templateLinks = (locale: SeoLocale, current?: SeoTemplateDefinition): string =>
  SEO_TEMPLATE_CATALOG.map((template) => {
    const copy = documents[locale].seo.templates[template.key];
    const pathName = seoTemplatePath(locale, template);
    const currentAttribute = current?.id === template.id ? ' aria-current="page"' : '';
    return `<li><a href="${pathName}"${currentAttribute}>${escapeHtml(copy.heading)}</a></li>`;
  }).join('\n');

const jsonLdForHome = (locale: SeoLocale, title: string, description: string) => ({
  '@context': 'https://schema.org',
  '@type': ['WebApplication', 'WebSite'],
  name: documents[locale].seo.brand,
  url: absoluteUrl(seoHomePath(locale)),
  description,
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Web',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  publisher: {
    '@type': 'Organization',
    name: documents[locale].seo.brand,
    url: SITE_URL,
  },
  inLanguage: locale,
  headline: title,
});

const jsonLdForTemplate = (
  locale: SeoLocale,
  template: SeoTemplateDefinition,
  title: string,
  description: string,
) => ({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: documents[locale].seo.brand,
  url: absoluteUrl(seoTemplatePath(locale, template)),
  description,
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Web',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  inLanguage: locale,
  headline: title,
  image: absoluteUrl(template.previewSrc),
  breadcrumb: {
    '@type': 'BreadcrumbList',
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
        name: documents[locale].seo.navigation.templates,
        item: absoluteUrl(seoHomePath(locale)),
      },
      { '@type': 'ListItem', position: 3, name: title },
    ],
  },
});

const renderFaq = (faq: readonly Faq[]): string =>
  faq
    .map(
      ({ question, answer }) =>
        `<details class="seo-faq-item"><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`,
    )
    .join('\n');

const renderHeader = (
  locale: SeoLocale,
  kind: 'home' | 'template',
  template?: SeoTemplateDefinition,
): string => {
  const copy = documents[locale].seo;
  return `<header class="seo-header">
    <a class="seo-brand" href="${seoHomePath(locale)}">${escapeHtml(copy.navigation.home)}</a>
    <nav aria-label="${escapeHtml(copy.navigation.templates)}">
      <a href="${seoHomePath(locale)}#templates">${escapeHtml(copy.navigation.templates)}</a>
      <a href="${seoHomePath(locale)}#how-it-works">${escapeHtml(copy.navigation.howItWorks)}</a>
      <a href="https://github.com/capynq/open-keychain">${escapeHtml(copy.navigation.github)}</a>
    </nav>
    <div class="seo-language" aria-label="${escapeHtml(copy.languageLabel)}">${languageLinks(locale, kind, template)}</div>
  </header>`;
};

const renderFooter = (locale: SeoLocale): string => {
  const copy = documents[locale].seo;
  return `<footer class="seo-footer">
    <span>${escapeHtml(copy.brand)} · MIT licensed</span>
    <a href="/privacy.html">${escapeHtml(copy.navigation.privacy)}</a>
    <a href="https://github.com/capynq/open-keychain">${escapeHtml(copy.navigation.github)}</a>
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
      <a class="seo-text-link" href="${seoTemplatePath(locale, template)}">${escapeHtml(copy.navigation.readMore)} →</a>
    </article>`;
  }).join('\n');
  return `<main class="seo-main seo-home">
    <section class="seo-hero" aria-labelledby="seo-home-heading">
      <div>
        <p class="seo-eyebrow">${escapeHtml(copy.brand)}</p>
        <h1 id="seo-home-heading">${escapeHtml(copy.home.heading)}</h1>
        <p class="seo-lede">${escapeHtml(copy.home.intro)}</p>
        <a class="seo-cta" href="/create?lang=${locale}">${escapeHtml(copy.home.cta)} <span aria-hidden="true">→</span></a>
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
    <nav class="seo-breadcrumbs" aria-label="Breadcrumb"><a href="${seoHomePath(locale)}">${escapeHtml(copy.navigation.home)}</a><span aria-hidden="true">/</span><span>${escapeHtml(copy.navigation.templates)}</span><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(templateCopy.heading)}</span></nav>
    <section class="seo-template-hero" aria-labelledby="seo-template-heading">
      <div>
        <p class="seo-eyebrow">${escapeHtml(copy.navigation.templates)}</p>
        <h1 id="seo-template-heading">${escapeHtml(templateCopy.heading)}</h1>
        <p class="seo-lede">${escapeHtml(templateCopy.intro)}</p>
        <a class="seo-cta" href="/create?template=${encodeURIComponent(template.id)}&amp;lang=${locale}">${escapeHtml(copy.home.cta)} <span aria-hidden="true">→</span></a>
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
  </main>`;
};

const renderPage = (
  locale: SeoLocale,
  kind: 'home' | 'template',
  template?: SeoTemplateDefinition,
): string => {
  const copy = documents[locale].seo;
  const isHome = kind === 'home';
  const pagePath = isHome ? seoHomePath(locale) : seoTemplatePath(locale, template!);
  const title = isHome ? copy.home.title : copy.templates[template!.key].title;
  const description = isHome ? copy.home.description : copy.templates[template!.key].description;
  const jsonLd = isHome
    ? jsonLdForHome(locale, title, description)
    : jsonLdForTemplate(locale, template!, title, description);
  const image = isHome ? '/brand/open-keychain-og.png' : template!.previewSrc;
  const imageDimensions = isHome ? { width: 1200, height: 630 } : { width: 640, height: 360 };
  const markup = isHome ? renderHomeMarkup(locale) : renderTemplateMarkup(locale, template!);
  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#f6f4ef" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="${absoluteUrl(pagePath)}" />
    ${alternateLinks(kind, template)}
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
    <link rel="stylesheet" href="/seo.css" />
    <title>${escapeHtml(title)}</title>
    <script type="application/ld+json">${escapeJson(jsonLd)}</script>
  </head>
  <body>
    ${renderHeader(locale, kind, template)}
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
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), rootIndex);

  for (const entry of SEO_PAGE_MANIFEST) {
    if (entry.kind === 'home' && entry.locale === 'en') continue;
    const template =
      entry.kind === 'template'
        ? SEO_TEMPLATE_CATALOG.find((candidate) => candidate.id === entry.templateId)
        : undefined;
    if (entry.kind === 'template' && !template)
      throw new Error(`Unknown SEO template: ${entry.templateId}`);
    const html = renderPage(entry.locale, entry.kind, template);
    writeFile(path.join(DIST_DIR, entry.path, 'index.html'), html);
  }

  const createTitle = 'Create a printable keychain - Open Keychain 3D';
  const createDescription =
    'Design a personalized printable keychain or label, preview the geometry, and export STL or 3MF locally.';
  const createShell = createAppShell(sourceIndex, createTitle, createDescription, '/create');
  const profileShell = createAppShell(
    sourceIndex,
    'Your projects - Open Keychain 3D',
    'Manage saved printable keychain projects.',
    '/profile',
  );
  writeFile(path.join(DIST_DIR, 'create/index.html'), createShell);
  writeFile(path.join(DIST_DIR, 'create.html'), createShell);
  writeFile(path.join(DIST_DIR, 'profile/index.html'), profileShell);
  writeFile(path.join(DIST_DIR, 'profile.html'), profileShell);

  const sitemapEntries = SEO_PAGE_MANIFEST.map((entry) => {
    const updatedAt = '2026-08-19';
    return `  <url>\n    <loc>${absoluteUrl(entry.path)}</loc>\n    <lastmod>${updatedAt}</lastmod>\n  </url>`;
  }).join('\n');
  writeFile(
    path.join(DIST_DIR, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>\n`,
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
    <title>Page not found - Open Keychain 3D</title>
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

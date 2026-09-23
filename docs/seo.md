# Search visibility checklist

The public SEO pages are rendered by React from the typed catalog and public API in
[`src/features/seo`](../src/features/seo). The build emits one `index.html`;
the SPA fallback serves localized routes, `/privacy`, and a noindex not-found state.

The catalog is the source of truth for the sitemap: every entry has a canonical path, locale, and page-specific
`lastModified` date. `pnpm seo:sitemap` generates the tracked sitemap from `SEO_SITEMAP_MANIFEST`, and production builds
run the generator before Vite copies public assets. Update a page's `lastModified` only when its main content, structured
data, or meaningful links change; do not use the build date. `pnpm validate:seo` checks the generated sitemap and its
route, image, and metadata contracts.

## Published indexable URLs

The release contains exactly 48 sitemap URLs: 33 static indexable URLs plus 15 finite localized customizer
entrypoints. The static set contains three localized home pages, three template hubs, twelve template pages, three
guide hubs, and twelve guide pages.

- English: `/`, `/templates/`, `/templates/<template>/`, `/guides/`, and `/guides/<guide>/`
- Russian: `/ru/`, `/ru/templates/`, `/ru/templates/<template>/`, `/ru/guides/`, and `/ru/guides/<guide>/`
- Ukrainian: `/uk/`, `/uk/templates/`, `/uk/templates/<template>/`, `/uk/guides/`, and `/uk/guides/<guide>/`

The initial guide slugs are `stl-vs-3mf`, `how-to-print-a-name-keychain`, `articulated-vs-standard-keychain`, and
`printable-plant-label-guide`. The four template slugs are `name-keychain`, `articulated-name`, `nameplate`, and
`plant-label`.

The indexable customizer entrypoints are `/create?lang=<locale>` and
`/create?template=<template>&lang=<locale>` for each of the four published templates and three supported locales.
The bare `/create`, any invalid or extra query such as `design=`, non-normalized query ordering, and `/profile` remain
`noindex,follow`; they remain linked from indexable pages as product experiences rather than search landing pages.

## Content and authority

Initial search intent is deliberately narrow and descriptive:

- printable name keychain generator
- 3D printable name keychain
- articulated name keychain
- 3D printable nameplate
- printable plant label

The localized pages use stable URLs and reciprocal `hreflang` links. Their JSON-LD is rendered with the route metadata
so crawlers that execute the SPA can associate each page with the product and its parent site. Add genuinely useful
examples, print settings, and maker guides only when they answer a real search question; avoid doorway pages and
repeated keyword variations.

Guide routes emit `Article` JSON-LD with localized headline, author, publisher, image, and modification date. The
customizer is the only route that emits `WebApplication` JSON-LD; privacy and unknown routes remain noindex.

## Search Console review

- Review the Page indexing and Sitemaps reports for unexpected exclusions, fetch failures, and canonical differences.
- Use URL Inspection on important routes in each locale to confirm Google can render the main content and sees the intended canonical.
- For content decisions, compare the latest 90 complete days with the preceding 90 in the Web Search Performance report. Group by query and page, then review country and device; average position is a trend signal rather than a fixed rank target.
- After publishing a material update, verify the sitemap remains processed and inspect the changed route. Request recrawling only for important changed URLs; indexing is not guaranteed.

## Growth priorities and baseline

The Search Console export received on 2026-09-23 covers Web search for the selected last-three-months range, with performance rows dated 2026-08-13 through 2026-09-21. Treat this as an early baseline: the device report totals 28 clicks and 290 impressions, and the report does not include a before/after comparison.

- Focus content work on the existing STL vs 3MF guide and the name-keychain/nameplate templates. The English STL vs 3MF guide had 39 impressions, no clicks, and average position 57.44; multiple related format queries also appeared without clicks. Improve the page with a concise, accurate export comparison and practical slicer checks instead of adding near-duplicate keyword pages.
- Keep English, Russian, and Ukrainian routes. Russian and Ukrainian home and template pages already receive clicks; do not infer that one locale should be dropped from these small samples.
- The Pages report showed 33 indexed and 20 not indexed at its latest chart date (2026-09-18): 12 discovered but not indexed, 4 excluded by `noindex`, 3 redirecting URLs, and 1 redirect error. The export has counts but no affected URL examples. Verify examples against the 48-route sitemap before changing directives or canonicals; preserve intentional private and redirected routes.
- Compare complete 28-day periods after Google recrawls the current SEO update. Review clicks and impressions by the STL/3MF query group, name-keychain/nameplate pages, and brand queries. Small query and page samples make individual CTR changes noisy; average position depends on query mix and is not a standalone target.
- Use [`marketing/maker-sharing-kit.md`](marketing/maker-sharing-kit.md) to prepare human-reviewed, non-paid project mentions with genuine preview or print images. Do not buy links, automate posting, or claim physical validation that has not been recorded.

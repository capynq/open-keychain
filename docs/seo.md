# Search visibility checklist

The public SEO pages are generated during `pnpm build` from the typed catalog in
[`src/infrastructure/seo/catalog.ts`](../src/infrastructure/seo/catalog.ts). The build emits localized HTML pages,
route-aware app shells, a sitemap, and a real 404 page into `dist/`.

The catalog is the source of truth for the sitemap: every entry has a canonical path, locale, and page-specific
`lastModified` date. `scripts/validate-seo-build.ts` checks that the sitemap has exactly one URL per catalog entry,
that URL order and `lastmod` values match, and that all dates use the XML sitemap `YYYY-MM-DD` format.

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

The localized pages use stable URLs and reciprocal `hreflang` links. Their JSON-LD is emitted as a linked `@graph`:
the organization, localized website, web application, and breadcrumb list use stable `@id` references so crawlers can
associate each landing page with the product and its parent site. Add genuinely useful examples, print settings, and
maker guides only when they answer a real search question; avoid doorway pages and repeated keyword variations.

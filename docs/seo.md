# Search visibility checklist

The public SEO pages are rendered by React from the typed catalog and public API in
[`src/features/seo`](../src/features/seo). The build emits one `index.html`;
the SPA fallback serves localized routes, `/privacy`, and a noindex not-found state.

The catalog is the source of truth for the sitemap: every entry has a canonical path, locale, and page-specific
`lastModified` date. Keep the tracked sitemap synchronized with the published route catalog when
adding or removing indexable pages.

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

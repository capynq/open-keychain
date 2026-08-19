# Search visibility checklist

The public SEO pages are generated during `pnpm build` from the typed catalog in
[`src/infrastructure/seo/catalog.ts`](../src/infrastructure/seo/catalog.ts). The build emits localized HTML pages,
route-aware app shells, a sitemap, and a real 404 page into `dist/`.

## Published indexable URLs

- English: `/` and `/templates/<template>/`
- Russian: `/ru/` and `/ru/templates/<template>/`
- Ukrainian: `/uk/` and `/uk/templates/<template>/`

The interactive `/create` and `/profile` shells are intentionally `noindex,follow`. They remain linked from the
indexable pages and are the product experience rather than search landing pages.

## Search Console rollout

After deploying a build:

1. Keep the existing `open-keychain.com` Google Search Console property verified.
2. Submit `https://open-keychain.com/sitemap.xml` again after URL or content changes.
3. Inspect the home page, each language home page, and each English template page.
4. Use the rendered-page inspection to confirm that the heading, links, preview image, canonical, and JSON-LD are visible.
5. Review indexing, impressions, queries, click-through rate, and average position over a 28-day window.

Sitemap submission is a discovery hint, not a guarantee of indexing or ranking. Search performance also depends on useful
content, demand, links from relevant sites, and competition.

## Content and authority

Initial search intent is deliberately narrow and descriptive:

- printable name keychain generator
- 3D printable name keychain
- articulated name keychain
- 3D printable nameplate
- printable plant label

The localized pages use stable URLs and reciprocal `hreflang` links. Add genuinely useful examples, print settings, and
maker guides only when they answer a real search question; avoid doorway pages and repeated keyword variations.

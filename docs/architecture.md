# Architecture boundaries

The frontend is being migrated toward Feature-Sliced Design (FSD). The
top-level directories are the current layer vocabulary:

| Layer      | Responsibility                                                 | May depend on                                        |
| ---------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| `app`      | application composition, routing, providers, and global styles | `pages`, `widgets`, `features`, `entities`, `shared` |
| `pages`    | route-level composition and page-specific orchestration        | `widgets`, `features`, `entities`, `shared`          |
| `widgets`  | reusable page-sized compositions                               | `features`, `entities`, `shared`                     |
| `features` | user-facing actions and workflows                              | `entities`, `shared`                                 |
| `entities` | business objects and their UI/model adapters                   | `entities`, `shared`                                 |
| `shared`   | reusable UI, utilities, infrastructure, and types              | `shared`                                             |

Dependencies point downward only. A lower layer must not import an upper
layer, and slices within a layer should communicate through an explicit public
API when one is intentionally retained. Avoid adding barrel files for
convenience; prefer direct source imports so dependency edges stay visible.
Keep application composition in `app`; do not move feature decisions into
shared utilities.

## Composition and models

Keep one exported React component per file. Route pages are composition-only:
they select widgets and features and should not contain catalog data, metadata,
or large state machines. Put typed interfaces and pure selectors in `model/`,
side effects and reusable state in `hooks/`, and browser-independent helpers in
`lib/`. Reuse the existing public header, footer, language picker, landing
sections, and controls instead of creating route-specific duplicates.

SEO and locale invariants have one source of truth in `features/seo`: localized
paths take precedence over conflicting query locales, generic app paths preserve
their query/state locale, privacy remains canonical at `/privacy`, and only the
customizer emits `WebApplication` structured data. Changes to these contracts
must include unit coverage and focused browser coverage.

## Boot frames

Landing (`/`) and the Customizer (`/create`) paint a server-rendered copy of their first screen
before the app entry runs; the hosted profile paints the `RouteLoading` skeleton. One registry,
`scripts/build/boot-routes.ts`, lists each frame's component, variants, page modules and output
document, and `scripts/build/route-boot-plugin.ts` renders them at build time (and on request in
development):

- The frames are the live components (`src/app/boot/*BootFrame.tsx`), so a layout change reaches
  the frame without a second copy. Keep new above-the-fold markup inside those components.
- Their stylesheets are the CSS reachable through static imports from the route's page modules,
  linked after the entry CSS. The build fails when a CSS-module class in a frame has no linked
  rule.
- The inline resolver in `index.html` picks the variant and the locale from the path, query and
  browser languages, like `detectInitialLocale`; `src/app/boot/boot-resolver.test.ts` checks the
  two agree on every SEO path. The build adds a script that preloads the picked locale's chunk
  (English ships with the entry; see `loadLocale` in `src/infrastructure/i18n/config.ts`).
- `src/app/boot/handoff.ts` removes the frame once React commits (on the landing page after the
  live hero image decodes, at most 150 ms). Tests that act on landing markup navigate with
  `gotoLive` from `e2e/helpers.ts`.
- `public/_redirects` serves `create/index.html` for `/create` (forced, or Netlify redirects to
  `/create/`) and `app.html`, which has no landing frame, for every other path. `vite preview`
  copies those rules.
- Each document also preloads its route's chunk graph; the landing document preloads the hero
  image from `ConfiguratorShowcase/hero-image.ts` and lists the editor's files for the idle
  prefetch (`src/app/routing/routePrefetch.ts`).

## Migration aliases

TypeScript, Vite, and Vitest expose matching aliases for `@/app/*`,
`@/pages/*`, `@/widgets/*`, `@/features/*`, `@/entities/*`, `@/shared/*`, and the existing transitional
directories (`@/domain/*`, `@/infrastructure/*`, `@/components/*`, and
`@/types/*`). Prefer the FSD aliases for new code. The broad `@/*` alias is
retained for compatibility with existing modules.

`src/entities/keychain` is a deliberate transitional adapter location. It may
import the legacy `src/domain/keychain` implementation and
`src/infrastructure/geometry` while that code is moved. New FSD code elsewhere
must not introduce dependencies on those legacy paths. Once the migration is
complete, remove the adapter exception and enforce the stricter boundary for
all entities and shared code.

Route compositions live in `src/pages/*`, with one page component per directory.
The SEO dispatcher in `src/pages/seo/SeoPage.tsx` is the sole route-kind entry
point; concrete SEO pages are private siblings and are never re-exported from
that dispatcher. The former `src/legacy` adapter layer has been removed;
application wiring imports concrete page files directly.

The remaining page-to-application seams are listed explicitly in the ESLint
configuration as migration exceptions. Do not add new exceptions; move shared
presentation and orchestration into `widgets` or lower layers first.

The ESLint flat config enforces lower-layer rules, import ordering, and the
no-barrel rule for new modules. Existing slice entry points are explicitly
allow-listed while their consumers migrate to direct imports; new compatibility
barrels are rejected. Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`,
`pnpm test`, and `pnpm build` before handing off a refactor.

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
layer, and slices within a layer should communicate through their public
`index.ts` API rather than reaching into another slice's internals. Keep
application composition in `app`; do not move feature decisions into shared
utilities.

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

The current `src/pages/*` entrypoints are also transitional: they delegate to
`src/legacy/pages/*` while route compositions are moved out of `src/app`. New
page code must not import `app` implementations; the legacy adapters are the
only temporary exception and are scheduled for deletion.

The ESLint flat config enforces the immediately actionable lower-layer rules
for new `entities` and `shared` files. Rules are intentionally scoped to those
directories during migration so existing application code can be moved in
small, reviewable steps.

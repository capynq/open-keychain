# Contributing

Open Keychain is a client-side React, Three.js, and Manifold project. Geometry and exports run locally in a worker, so changes should preserve printable, manifold output and keep preview-only surfaces out of files.

Before opening a pull request:

```sh
pnpm validate
pnpm bench:matrix
pnpm test:e2e --workers=1
```

The pre-push hook repairs formatting and lint issues in changed files, then selects the local gates from the files in the push:

- Every code push runs typecheck, unit tests, and a production build with the deterministic Playwright Google-font key.
- UI, route, export, public-asset, and E2E changes also run the focused Playwright smoke suite (six checks across desktop and mobile) against that existing build.
- Geometry and font changes also run `pnpm bench:matrix`.
- Docker, nginx, or hosting changes also validate both Compose profiles and build/test the self-hosted image.
- Documentation-only pushes run only the changed-file formatter/linter checks.

Install Chromium once with `pnpm exec playwright install chromium`. Docker is needed only for hosting-related changes.

The hook can be bypassed with `HUSKY=0 git push`, but that skips all of these local safety gates and leaves GitHub's main-branch quality workflow as the remaining check.

For a focused local run:

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e:smoke
```

The full browser matrix remains available for release validation with `pnpm test:e2e --workers=1`. To opt into it from the pre-push hook, use `PUSH_E2E_MODE=full git push`; `PUSH_E2E_WORKERS` controls its worker count. Smoke validation defaults to two workers.

## Formatting

Run `pnpm format` before committing and use `pnpm format:check` in CI. TypeScript and JavaScript use a 100-column print-width guideline; Markdown, JSON, stylesheets, and generated declaration/configuration files retain a 120-column width. Prettier's `objectWrap: "preserve"` keeps an object literal multiline when its opening brace is followed by a newline, while long single-line objects wrap automatically at the configured width.

Prettier does not infer semantic groups between variables and methods. The targeted ESLint `padding-line-between-statements` rule inserts a blank line after declarations before expressions or returns in React feature code; keep one intentional blank line between hook calls, derived values, effects, handlers, and returns. Prettier preserves it but collapses repeated blank lines.

Use the existing style and camera tests as templates for new geometry cases. Add a regression test for every new validation rule, export format, locale, or viewer interaction.

## Commit and review workflow

Use conventional commit messages such as `feat(geometry): preserve counters during bridging` or `fix(viewer): keep long models inside the camera bounds`. Husky and lint-staged run staged-file checks before commits; Commitlint rejects messages outside the conventional format.

Keep pull requests focused, explain user-facing behavior, and update README or localization when the public behavior changes. Never commit credentials, production environment files, generated meshes, or browser test artifacts.

# Contributing

Open Keychain is a client-side React, Three.js, and Manifold app. Geometry and exports run locally in a Web Worker, so every change must keep output printable and manifold, and must keep preview-only surfaces out of exported files.

## Quick start

```sh
pnpm install
pnpm exec playwright install chromium   # once, for browser tests
pnpm dev                                # editor at /create
```

Before asking for review, run `pnpm format:check`, `pnpm lint`, and `pnpm typecheck`.

## Validation

| Command                     | What it runs                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm validate:push`        | Checks selected from the pushed changes. Runs automatically on `git push`; safe to run by hand. |
| `pnpm validate`             | Format, lint, typecheck, all unit tests, build, and the critical browser journey.               |
| `pnpm validate:full`        | Everything above plus the full browser suite and all 4,267 geometry matrix cases.               |
| `pnpm validate:changed`     | Checks selected from your uncommitted changes.                                                  |
| `pnpm validate:bench`       | Repeats a profile and compares timings (`[push\|ui\|geometry\|docs\|full\|ci] [runs]`).         |
| `pnpm validate:cache:clear` | Clears the local validation cache.                                                              |

Geometry matrix results are automated printability evidence, not physical-print verification.

### What a push checks

Every push must pass the **critical user journey** (`pnpm test:e2e:journey`): landing → setup → edit → preview → STL and both 3MF exports → recovery from a worker failure, on desktop, mobile, and mobile-2x. Downloaded files are parsed and checked. This gate always runs fresh: it can't be skipped, cached, or satisfied by skipped, focused (`.only`), or partial runs.

Other checks depend on what changed:

- **Docs only:** formatting of the changed files.
- **UI/CSS:** related unit tests, typecheck, build, and browser smoke. Changed Playwright specs run directly.
- **Geometry, export, fonts, WASM:** related unit tests (including the builder, worker, and font suites), typecheck, and build. The full geometry matrix runs only in `validate:full` or a manual CI run.
- **Tests only:** the changed tests.
- **Tooling, config, or unknown paths:** the conservative full set.

The hook also requires a clean tree: commit or remove tracked changes and relevant untracked files first. It deletes stray `.DS_Store` files and temporarily moves local `.env*` files aside so machine settings can't affect results. They are restored afterwards. Keep secrets in `.env*`; commit only `.env.example`.

Don't bypass the hook with `--no-verify` or `HUSKY=0`. Fix the failing check instead.

### Speed and parallelism

Validation uses all but two CPU cores (up to 8; machines with 4 or fewer cores use all of them). Set `VALIDATION_CONCURRENCY=4` to keep your machine responsive during a run.

| Variable                 | Default          | Effect                                                                                                     |
| ------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| `VALIDATION_CONCURRENCY` | cores − 2, max 8 | Total parallel budget. The full unit suite uses all of it; the fast unit suite and browser tests use half. |
| `MATRIX_CONCURRENCY`     | same as above    | Geometry matrix workers (1–8, about 1–2 GB of memory each).                                                |
| `PLAYWRIGHT_WORKERS`     | 2                | Workers for `pnpm test:e2e:full`.                                                                          |
| `VALIDATION_CACHE=0`     | cache on         | Ignores cached results (use for cold timings).                                                             |
| `VALIDATION_UI`          | `auto`           | `tui`, or `plain` for no terminal UI.                                                                      |

Vitest runs test files in parallel, but the tests inside one file run one after another. Keep long geometry suites split across several files, like `keychain-builder.styles-fonts.<style>.test.ts`, instead of growing one file. `pnpm test:fast` skips the heavy `keychain-builder.*.test.ts` files; `pnpm test` runs everything.

The geometry matrix remembers how long each case took and starts the slowest ones first. If a case becomes more than 3× slower than last time, it is listed under `slowdowns` in the run summary.

### Caching

Successful checks are cached in `node_modules/.cache/open-keychain-validation`, keyed by their inputs, command, Node version, lockfile, and relevant environment variables. A documentation edit doesn't invalidate geometry results, and the build cache verifies its `dist` output before browser tests reuse it. The critical journey is never cached. CI doesn't use the local cache.

### Terminal UI

In an interactive terminal, validation shows a live view. Keys: `↑`/`↓` select a check, `l` toggles its log, `v` toggles detail, `?` shows help, `s` then `y` skips an optional check, and `Ctrl+C` cancels. Required checks can't be skipped. A skipped push run is reported as partial, and CI must still pass before deploy. Set `NO_COLOR` to disable colors.

## Main branch and production

Work happens directly on `main`. After a push, GitHub Actions runs the `quality` job: checks selected from the changed paths, plus the critical journey. Production build and deploy wait for `quality`. The exact Netlify production `dist` must pass the critical journey again before it is deployed. A manual `workflow_dispatch` run executes the full unit, browser, and geometry profiles.

## Code conventions

- Frontend code follows the FSD boundaries in `docs/architecture.md`: one component per file, composition-only route pages, and dedicated model, hook, and library modules.
- All user-visible strings go through i18n, with keys in every locale (`en`, `ru`, `uk`).
- Add regression tests for new validation rules, export formats, locales, or viewer interactions. Existing style and camera tests are good templates for new geometry cases.
- Don't run capture or autofix commands in unattended validation; they can modify tracked files.

## Benchmarking Bun (optional)

`pnpm validate:bench runtime --sample=100 --runs=3 --concurrency=4` compares Node and Bun on the geometry matrix (`--full` for all cases; `BUN_BINARY` to pick a binary). Bun is not the default runtime. Consider it for the matrix runner only with at least a 20% median speed gain, no more than 10% higher peak memory, and identical results.

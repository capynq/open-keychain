# Contributing

Open Keychain is a client-side React, Three.js, and Manifold project. Geometry and exports run locally in a worker, so changes should preserve printable, manifold output and keep preview-only surfaces out of files.

## Validation profiles

```sh
pnpm validate:push          # selected checks for the pushed commit (Husky pre-push)
pnpm validate:full          # full local format/lint/typecheck/unit/build/browser/geometry
pnpm validate:ci            # full format/lint/typecheck/unit/build profile
pnpm validate:ci:changed    # CI-selected gates (requires CHANGED_FILES_JSON)
pnpm validate:bench          # repeat the quick validation profile and compare timings
pnpm validate:cache:clear    # remove only node_modules/.cache/open-keychain-validation
```

`pnpm validate:bench [push|ui|geometry|docs|full|ci] [runs]` accepts a profile and 1–10 repeats. It reports wall times, per-gate durations, slowest tests/cases, and matrix phase/worker/memory data. Run once with `VALIDATION_CACHE=0` for cold measurements, then again normally for a warm-cache comparison. `VALIDATION_CONCURRENCY` must be a whole number from 1 to 8 and defaults to 2. Geometry uses a shared process budget: effective workers are the lower of `MATRIX_CONCURRENCY` (1–5, default 2) and `VALIDATION_CONCURRENCY`; raise both to run more geometry workers. `MATRIX_PACKAGE_SIZE` defaults to four cases per assignment.

Compare Node with installed Bun using `pnpm validate:bench runtime --sample=100 --runs=3 --concurrency=4`; the report is stored under `node_modules/.cache/open-keychain-validation/benchmarks`. Use `--full` to benchmark the complete 4,267-case matrix. Set `BUN_BINARY` to choose a specific Bun executable. The comparison disables validation cache, checks per-case outcomes, and reports phase time, CPU, and memory. Bun is not the default validation or production-build runtime; consider adopting it for the matrix runner only after at least a 20% median wall-time gain, no more than 10% higher peak worker RSS, and matching results. Verify process/WASM compatibility under the exact Bun version being measured.

## Local push checks

The Husky pre-push hook reads Git's ref input and verifies the pushed commit is the checked-out `HEAD`. Before validation it removes untracked macOS `.DS_Store` metadata and temporarily moves ignored root `.env*` files outside the checkout, restoring them on success, failure, or cancellation. This prevents machine-local Vite settings and Finder files from changing the result; these files are never staged. Other untracked files that can affect validation and all tracked modifications are still rejected, so commit or remove those before pushing. Keep secrets in `.env*`; commit only sanitized `.env.example` values. An ordinary push chooses gates from the changes:

- Documentation runs changed-file formatting.
- UI/CSS changes run related Unit tests, typecheck, build, and Browser smoke. Changed Playwright specs run directly.
- Geometry, export, font, and WASM changes run related Unit tests plus explicit tests for dynamic builder/worker/font boundaries, typecheck, and build. Routine CI skips Browser and the 4,267-case Geometry matrix for these changes.
- Test-only changes run the changed tests. Validation-tooling and configuration changes run owning tests where mapped; unknown paths use the cost-first format/lint, typecheck, and build fallback.
- Deleted and renamed paths remain in classification. Related test paths are filtered to files present in the checkout; an empty selection is reported as `not selected`, never as a passing Unit suite.

The full builder geometry tests are grouped into separate contracts, style/font, magnet/nameplate/plant-label, and keyring/articulated files. `pnpm test:fast` excludes these expensive geometry integrations. `pnpm test:full`, `pnpm validate:full`, and the manual CI dispatch include all of them.

Successful local gates are cached separately under `node_modules/.cache/open-keychain-validation`, keyed by each gate's relevant tracked/untracked input content, command, Node/platform, lockfile and relevant environment. Geometry fingerprints include builder/templates, export serializers, fonts, WASM, matrix code, and package metadata, so documentation changes do not invalidate geometry. Only successful completion is saved. The build cache also saves and digest-checks its `dist` artifact before browser tests can use it. Cache bypass is `VALIDATION_CACHE=0`; clear it with the command above. CI disables local validation results and verifies its checkout independently.

## TUI and plain mode

`VALIDATION_UI=auto|tui|plain` selects the live terminal view. `auto` uses TUI only for an interactive terminal outside CI; `tui` explicitly requests it, and `plain` never sends ANSI control sequences. TUI colors use a warm Open Keychain accent with cyan active states, green success, red failure, amber warnings/skips, and violet cache hits. Set `NO_COLOR` or `TERM=dumb` to disable color; `FORCE_COLOR` does not enable the TUI without an interactive terminal. Keyboard input comes from `/dev/tty`, not the pre-push ref stream. If the controlling terminal is unavailable or cannot switch modes, validation falls back to plain output and disables keyboard controls.

- `↑` / `↓`: select a gate.
- `l`: show or hide the selected gate's log tail and log path.
- `v`: show shorter or more detailed diagnostics.
- `?`: show key help.
- `s`: request a skip for an optional local gate, then confirm with `y`; `N` cancels.
- `Ctrl+C`: cancel validation and the push.

Required checks cannot be skipped. Quick-profile skips are reported as `SKIPPED BY USER` and `Local validation partial; CI must complete before deployment`. Full-profile skips fail the command. CI has no keyboard skip path. A skip never creates a cache entry.

## Main and production workflow

Work directly on `main`; GitHub Actions runs after a direct push and cannot reject that push. The stable required status is `quality`. Routine checks classify changed paths and run sequentially on one runner after one dependency install. Selected failures fail `quality`; intentionally unselected Browser and full Geometry checks are printed as not selected. Manual `workflow_dispatch` runs full format, lint, typecheck, Unit, build, Browser, and Geometry profiles on the same runner. Production build and deploy wait for `quality` and use Netlify's `production` build context/environment.

Install Chromium once with `pnpm exec playwright install chromium`. `pnpm validate:full` is the exhaustive local regression command: full format, lint, typecheck, Unit, build, Browser, and all 4,267 Geometry cases. These are automated checks, not physical-printer evidence.

## Formatting and architecture

Run `pnpm format:check`, `pnpm lint`, and `pnpm typecheck` before reviewing a meaningful change. Prettier retains the repository's configured widths. Frontend additions follow the FSD boundaries documented in `docs/architecture.md`: one component per file, composition-only pages, dedicated model, hook, and library modules, and centralized SEO and locale invariants.

Use existing style and camera tests as templates for new geometry cases. Add regression assertions for new validation rules, export formats, locales, or viewer interactions. Do not use capture or autofix commands in unattended validation because they can modify tracked files.

# Contributing

Open Keychain is a client-side React, Three.js, and Manifold project. Geometry and exports run locally in a worker, so changes should preserve printable, manifold output and keep preview-only surfaces out of files.

## Validation profiles

```sh
pnpm validate:push          # selected checks for the pushed commit (Husky pre-push)
pnpm validate:full          # full local format/lint/typecheck/unit/build/browser/geometry
pnpm validate:ci            # required CI format/lint/typecheck/full unit/build checks
pnpm validate:bench          # repeat the quick validation profile and compare timings
pnpm validate:cache:clear    # remove only node_modules/.cache/open-keychain-validation
```

`pnpm validate:bench [push|ui|geometry|docs|full|ci] [runs]` accepts a profile and 1–10 repeats. It reports wall times, per-gate durations, slowest tests/cases, and matrix phase/worker/memory data. Run once with `VALIDATION_CACHE=0` for cold measurements, then again normally for a warm-cache comparison. `VALIDATION_CONCURRENCY` must be a whole number from 1 to 8 and defaults to 2. Geometry uses a shared process budget: effective workers are the lower of `MATRIX_CONCURRENCY` (1–5, default 2) and `VALIDATION_CONCURRENCY`; raise both to run more geometry workers. `MATRIX_PACKAGE_SIZE` defaults to four cases per assignment.

Compare Node with installed Bun using `pnpm validate:bench runtime --sample=100 --runs=3 --concurrency=4`; the report is stored under `node_modules/.cache/open-keychain-validation/benchmarks`. Use `--full` to benchmark the complete 4,267-case matrix. Set `BUN_BINARY` to choose a specific Bun executable. The comparison disables validation cache, checks per-case outcomes, and reports phase time, CPU, and memory. Bun is not the default validation or production-build runtime; consider adopting it for the matrix runner only after at least a 20% median wall-time gain, no more than 10% higher peak worker RSS, and matching results. Verify process/WASM compatibility under the exact Bun version being measured.

## Local push checks

The Husky pre-push hook reads Git's ref input, verifies the pushed commit is the checked-out `HEAD`, and rejects tracked modifications plus untracked files that can affect validation. An ordinary push chooses gates from the changes:

- Documentation runs changed-file formatting.
- UI/CSS runs changed format/lint, typecheck, the fast unit suite (or an isolated changed-test run when every changed path is a test), a production build when source/assets/config affect it, and browser smoke when UI routes/components change.
- Geometry, bundled fonts and WASM run geometry contracts and the full export matrix. Export changes also run related serializers and the matrix.
- Lockfiles, shared configuration, Husky and validation tooling use the conservative full local profile.
- Deleted files remain part of classification. Dynamic imports and asset changes fall back to the fast unit suite; an empty `vitest related` result is never used as evidence that no tests apply.

The full builder geometry tests are grouped into separate contracts, style/font, magnet/nameplate/plant-label, and keyring/articulated files. `pnpm test:fast` excludes these expensive geometry integrations. `pnpm test:full` and CI include all of them.

Successful local gates are cached separately under `node_modules/.cache/open-keychain-validation`, keyed by each gate's relevant tracked/untracked input content, command, Node/platform, lockfile and relevant environment. Geometry fingerprints include builder/templates, export serializers, fonts, WASM, matrix code, and package metadata, so documentation changes do not invalidate geometry. Only successful completion is saved. The build cache also saves and digest-checks its `dist` artifact before browser tests can use it. Cache bypass is `VALIDATION_CACHE=0`; clear it with the command above. CI disables local validation results and verifies its checkout independently.

## TUI and plain mode

`VALIDATION_UI=auto|tui|plain` selects the live terminal view. `auto` uses TUI only for an interactive terminal outside CI; `tui` explicitly requests it, and `plain` never sends ANSI control sequences. Keyboard input comes from `/dev/tty`, not the pre-push ref stream. If the controlling terminal is unavailable or cannot switch modes, validation falls back to plain output and disables keyboard controls.

- `↑` / `↓`: select a gate.
- `l`: show or hide the selected gate's log tail and log path.
- `v`: show shorter or more detailed diagnostics.
- `?`: show key help.
- `s`: request a skip for an optional local gate, then confirm with `y`; `N` cancels.
- `Ctrl+C`: cancel validation and the push.

Required checks cannot be skipped. Quick-profile skips are reported as `SKIPPED BY USER` and `Local validation partial; CI must complete before deployment`. Full-profile skips fail the command. CI has no keyboard skip path. A skip never creates a cache entry.

## Main and production workflow

Work directly on `main`; GitHub Actions runs after a direct push and cannot reject that push. It always requires format, lint, typecheck, the full unit suite, and build. Git history independently selects browser smoke for browser-affecting changes and the full geometry/export matrix for geometry, font, WASM or export changes. If a baseline is missing, CI selects both optional suites conservatively. A final required-checks job distinguishes `not required` from a failed/cancelled job. Production build and deploy wait for that gate and use Netlify's `production` build context/environment. The manual production bypass workflow has been removed.

Install Chromium once with `pnpm exec playwright install chromium`. `pnpm validate:full` runs browser coverage and the complete geometry matrix locally; these are automated checks, not physical-printer evidence.

## Formatting and architecture

Run `pnpm format:check`, `pnpm lint`, and `pnpm typecheck` before reviewing a meaningful change. Prettier retains the repository's configured widths. Frontend additions follow the FSD boundaries documented in `docs/architecture.md`: one component per file, composition-only pages, dedicated model, hook, and library modules, and centralized SEO and locale invariants.

Use existing style and camera tests as templates for new geometry cases. Add regression assertions for new validation rules, export formats, locales, or viewer interactions. Do not use capture or autofix commands in unattended validation because they can modify tracked files.

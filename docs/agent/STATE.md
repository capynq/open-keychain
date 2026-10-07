# Agent handoff

## Current work

- Implemented local validation profiles, changed-file planning, event-driven gates, streaming per-gate logs, bounded diagnostics, fail-fast cancellation, interactive/plain renderers, and success-only local caching with verified build artifacts.
- Split the heavy keychain-builder tests into four isolated files. The geometry/export matrix remains complete at 4,267 stable cases and now runs a persistent worker pool over balanced packages, reports per-phase CPU/time/memory, and emits per-case outcomes for parity checks.
- CI runs the full matrix on eight deterministic shards with four workers per shard. Its aggregator rejects missing/duplicate/misassigned cases, failures, unexpected-invalid counts, and a matrix duration over five minutes. The validation scheduler caps matrix workers by the shared concurrency budget; CI sets both limits to four.
- Direct-main CI requires format, lint, typecheck, full unit and build. It conditionally requires browser smoke and the full geometry matrix, and production build/deploy wait for `required-checks`. `ci.yml` is the only workflow with a production deployment command; the separate Netlify production workflow was removed.
- Updated CONTRIBUTING and geometry validation docs with profiles, cache, TUI, worker settings, direct-main deployment behavior, matrix sharding, and the Node/Bun benchmark.

## Validation and measurements

- `VALIDATION_CONCURRENCY=4 VALIDATION_UI=plain VALIDATION_CACHE=0 pnpm validate:ci` passed format, lint, typecheck, build, and all 639 unit tests in 5m24s on macOS ARM64.
- Focused matrix/scheduler/workflow checks passed: 20 tests; geometry contract file passed 72 tests. `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, and `git diff --check` passed.
- A full local Node shard completed all 536 assigned cases (536 passed, 0 expected invalid, 0 failed) in 217.6s with four workers; max single-case time was 28.7s and peak worker RSS was 904 MB. The other seven shards were not run locally; hosted Linux CI remains the acceptance check for full coverage and the five-minute target.
- Node 24.15.0 vs installed Bun 1.3.5 A/B on the same stratified 100-case sample, three runs each, four workers: median 35.827s vs 31.745s (Bun 11.4% faster), exact per-case outcome parity, and peak worker RSS ratio 1.09. This misses the 20% adoption threshold; Node remains canonical. `pnpm validate:bench runtime --sample=100 --runs=3 --concurrency=4` reproduces it. The report is under `node_modules/.cache/open-keychain-validation/benchmarks/`.
- Profile data shows `buildKeychain`/WASM dominates the measured work; mesh scans and STL/3MF validation are a small fraction. Mesh validity now scans typed arrays without allocating full JS-array copies. No native geometry rewrite or runtime/package-manager migration was made.
- Earlier work recorded a full 4,267-case sequential local matrix at 183m08s with two workers, versus the prior 40m41s run. The new sharded path is materially different, but a complete hosted run has not yet confirmed the target.
- Browser smoke previously passed 6/6 desktop/mobile cases. Actual `/dev/tty` key/resize/skip restoration remains unverified because the sandbox denied terminal access; plain mode and terminal-unavailable fallback were exercised.

## Repository state and next action

- Branch `main`, HEAD `d4bc544`, already one commit ahead of `origin/main` before this task. Current work remains uncommitted. No commit, push, PR, or deploy was performed.
- `git diff --check` is clean. Working tree contains the validation runner/cache/TUI, test split, CI, documentation, and matrix changes; preserve them during review.
- Next action: inspect the local diff, then let the normal GitHub Actions run validate all eight shards on hosted Linux. Production deploy remains gated on the required-checks job.

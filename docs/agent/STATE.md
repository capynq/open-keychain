# Agent handoff

## Boot frames and first-screen loading, 2026-11-07

On `feature/dreamy-franklin-epfa18`. See DECISIONS entries dated 2026-11-07.

- Header button bug: since `01bdbe7` `IconButton.module.css` sat in a shared chunk the boot frame
  never linked, so Quick setup and Export stacked icon over label until the editor loaded. Boot CSS
  now comes from the chunk graph, and the build fails on any frame class without a linked rule.
- `/` boots from the real header, hero and workflow (`LandingBootFrame`); one registry
  (`scripts/build/boot-routes.ts`) drives landing, Customizer and profile frames. The build writes
  `index.html`, `create/index.html` and `app.html` (fallback, `/* /app.html 200`). Landing boxes
  match the live page within 1 px at 390–1920 px in production and development.
- Bundled font specimens come from `public/fonts/specimens-<hash>.svg` (`pnpm assets:font-specimens`);
  design cards from `/showcase/v1/cards/` (`pnpm assets:landing`).
- Measured on the PR 68 deploy preview against production (`main`), 4x CPU, CDP throttling,
  medians of 5. This container's proxy limits Chromium to HTTP/1.1 (`nextHopProtocol`), so real
  HTTP/2 was not measured:
  - `/create` at 200 KB/s: wire 4580 → 943 KB, FCP 1.25 → 1.09 s, LCP 12.5 → 4.1 s, app ready
    21.7 → 4.4 s, first preview 25.9 → 7.6 s.
  - `/create` at 10 Mbps: FCP 868 → 756 ms, LCP 2.65 → 1.18 s, ready 4.5 → 1.6 s, first preview
    6.6 → 3.5 s (390 px and `ru-RU` alike).
  - `/` on a phone at 200 KB/s: FCP 3.16 → 0.94 s, LCP 3.16 → 1.20 s, ready 3.14 → 3.11 s, wire
    411 → 382 KB. `/` at 10 Mbps: LCP 1.42–1.48 s → 0.68 s.
  - One hero image request per device (390w at 1x, 780w at 2x and 3x, 720w/1440w on desktop);
    production's 1x phones fetched 490w. `/create` answers 200 instead of a 301 to `/create/`.
  - English visitors request no locale chunk; `ru`/`uk` visitors request theirs within 4 ms of the
    entry, and React's first commit is already localized.
- Deployment suite (`playwright.deployment.config.ts`) passes against the preview. From this
  container `page.request` needs `use.proxy` set to `HTTPS_PROXY`; the browser already uses it.
- Push gates passed first time with two slots per Playwright worker (4 min on four cores).
- Open:
  - `styles/magnet-*.png` are copies of the name keychain renders (keyring hole); recapture.
  - `playwright.dev-boot.config.ts` (not in CI or push gates): "handles concurrent cold and repeat
    Customizer loads" and "keeps actual model pixels through reload and navigation" time out in
    this container on `main` as well; Firefox is not installed here.

## Feedback collection and landing conversion, 2026-11-06

On `feature/peaceful-goodall-13iv0t` (restarted from `main` after PR #66 merged). See DECISIONS
"Explicit feedback is sent on submit".

- The PostHog "Customizer feedback" widget had 0 impressions since 2026-10-06 (button widget with
  no selector never renders) and was ended. 30-day consenting volume: 59 landing viewers, 33
  `start_designing`, 94 editor openers, 37 exporters.
- New `src/features/feedback/`: post-export rating + text inside the export dialog, a print-outcome
  card on return visits, a "Send feedback" dialog (controls panel footer, landing/SEO footer,
  closing CTA) and "Send a photo" mailto links that carry the last exported design link. Two PostHog
  `api` surveys hold the responses; visitors without consent send one anonymous request on Send.
- Every recovery notice has "Email support" and "Copy error report"
  (`src/shared/lib/support/*`): code, message, app build, page, browser, last 10 in-memory errors
  and the open design link (`setSupportDesignUrlProvider`).
- Landing: hero name field replaces the duplicated 3-step strip and prefills quick setup through
  router state (`setupText`, never in the URL); a closing call to action with the same field and
  the feedback line; softer beta headline; "See the Maker plan"; header, template-card and closing
  CTAs now track `start_designing` sources. The carousel order is unchanged because the first slide
  is the preloaded LCP image.
- Test builds set `VITE_POSTHOG_KEY=phc_playwright` and `VITE_POSTHOG_HOST=https://posthog.test`
  (Playwright web server and validation build gates); `e2e/routes.spec.ts` consent test answers that
  host, and `e2e/feedback.spec.ts` asserts the exact capture payloads.
- Follow-up after deploy: submit one consented and one anonymous response on production and confirm
  both in the PostHog survey results; check that `cabinet.open-keychain.com` forwards `/i/v0/e/`.

## Keyring placement, position picker and Pro value fields, 2026-11-06

On `feature/peaceful-goodall-13iv0t`. See DECISIONS "Keyring openings are placed by position and
proven clear".

- Articulated names carry the ring on the letter matching the position (first, last or middle);
  previously Right put it between the first two letters.
- Every builder path keeps the keyring opening and rejects `keyring-opening-blocked`; rings are
  pushed out until clear, diagonals scan a wider band, mirrored extremes resolve downward.
- `pnpm test:geometry:keyring [base|offset|texts|subtitle|fonts|all] [filter]` builds every keyring
  template × style × position (942 cases for `all`); the only rejections are the existing
  single-letter articulated and Latin-only articulated font rules, which the script skips.
- Keyring position picker draws generated artwork per template and style
  (`pnpm assets:keyring-previews`, `--check`), with markers on the real opening centres and a
  measured, collision-free 44 px layout; `public/showcase/keyring-position-alex.png` was removed.
- Pro range value fields no longer inherit the 44 px generic field rule: 28 px desktop, 36 px
  phone, one fixed width; range rows are 16 px apart, and every adjustment group after Typography
  (Template details and Print included) now has a divider so groups stay further apart than rows.
- Design review follow-up: the Keyring section is flat like its neighbours (no tinted card), its
  legends read "Opening" and "Position" with the selected position at the end of the legend row,
  quick setup hides both keyring legends behind the step title and widens the drawing, the opening
  picker takes its colors from tokens, and the position drawing shows the tab of the chosen opening
  preset (artwork now stores tabs per preset as relative SVG paths).

Known environment issue: `e2e/keychain.spec.ts:983` (viewer width at 390 px) fails here on this
branch and on the unchanged base commit alike; Playwright browsers need
`launchOptions.executablePath: '/opt/pw-browsers/chromium'` in this container.

## Customizer UX pass, 2026-11-05

Uncommitted on `main`; no commit or push. Owner-approved review items implemented (see DECISIONS
"Customizer UX pass"): colors kept on template switches, 50-step undo/redo with shortcuts, Print
facts replaced by a readout line plus an on-demand notice, sharp-model rebuild feedback with a
queued Export, one-row phone header and sticky phone preview, segmented Simple choices, template and
style grid, sidebar section links, inline checking state, conditional resets, Pro value fields,
model crossfade and camera preset tweens, Views menu, labelled Quick setup with prefilled reopen and
clickable steps, export warnings list and Recommended badge, slim consent bar, toast fade-out, and
the over-width warning wording fix.

Validation in a cloud container with software WebGL and the pre-installed Chromium (Playwright 1.64
needed `executablePath: /opt/pw-browsers/chromium` through a temporary local config, now removed):
`format:check`, `lint`, `typecheck` pass; `test:fast` 96 files / 753 tests; smoke 6/6; journey 9/9
(desktop, mobile, mobile-2x); keychain, font-browser, quick-setup, recovery-accessibility,
contextual-actions, routes, simple-editor, display-surfaces and motion 115/116 at two workers (the
remaining recovery-accessibility test passes 3/3 alone; it allows 5 s for first ready). Also
failing on the untouched baseline here: `carousel.spec.ts:100` and the 3,000 ms startup budget
(baseline 3,280 ms, new 3,465 ms). Not run: Firefox, Safari, geometry matrix, full mobile project.

Open: Pro sidebar is longer (4,563 px vs 4,290 px) with full-width sliders; camera fit distance is
unchanged by decision.

## Committed and review follow-ups, 2026-11-04

Committed on `main` (owner-authorized; not pushed): `5b487b1` chore(lint), `c98b950` feat(customizer), `c36d8a3` docs, then the fixes below in one `fix` commit.

- A preview cache hit now supersedes the active and queued previews instead of leaving the queued one to build.
- The pooled prewarmed engine is released when the app navigates to a route other than landing (including `/ru/`, `/uk/`) or `/create` (`useGeometryPrewarmRelease`); the release never triggers the lazy pool import.
- Preview-quality step-up cooldown is measured from the last tier change, step-downs included.
- Removed the unreachable boot-timeout comparison in `exportErrorCode`; boot timeouts map to `timeout` via their diagnostics (guard test).

Validation before the fix commit: `format:check`, `lint`, `typecheck`, `test:fast` (95 files / 746 tests), `build`, `test:e2e:smoke` 6/6, `test:e2e:journey` 9/9, recovery/preview-quality/keychain/export-recovery/quick-setup on desktop+mobile 124/124, `performance.spec.ts --workers=1` desktop+mobile 10/10. Firefox not run.

`pnpm validate:push` first failed twice on default 5 s vitest timeouts under parallel browser load (`validation-ci-workflow.test.mjs` spawnSync test, `edge-finish.test.ts` ALEX 0.6/0.8 mm, `feature-graph.test.ts` real Manifold nodes; 1–2 s alone). `e93d44e` gives them the repository's 30 s real-geometry timeout. After that, `pnpm validate:push` passed on `e93d44e` (1m51s): typecheck, lint, build, format, browser smoke, unit:fast, journey 9/9, browser regression 42/42. Not pushed.

Open: the 45 s boot watchdog includes worker and WASM download; check field `worker_boot_ms` after deploy. Review cleanups not done: superseded results not cached, per-request font hashing, main-thread clone of cached responses, duplicated telemetry key lists, sanitizer hardening for untyped keys (pre-existing), boot-plugin base-path check, `applyQuality` and lint-rule tests.

## Code-review follow-up and coarse-first withdrawal, 2026-11-04

Uncommitted on `main`; no commit or push. Two `/code-review` passes; each finding was verified by code reading or a failing test before fixing.

Kept fixes:

- No automatic current-design re-request after `geometry-request-timeout`; boot-timeout and worker-crash still re-request (`useGeometryGeneration.ts`; DECISIONS respawn entry narrowed).
- `client_round_trip_ms` is measured from dispatch to the worker and `client_queue_ms` is the wait before dispatch, for previews and validations (`geometry-client.ts`).
- A queued preview whose key is already cached resolves from the client cache without a worker round trip; queued inline-font previews and non-cacheable candidate validations carry no cache key.
- Not real after checking: pooled `worker_boot_ms` inflation, half-applied accept (routed to `recordRejectedAttempt`; guard test in `useCustomizerParams.test.ts`), per-render effect churn, `worker_replacements` on the retired `geometry_error` event, preload double download (Chromium reuse measured earlier).

Coarse-first withdrawn (owner decision). Measured in node (desktop proxy, warm medians over 8 designs): coarse 32 cost 68–85% and coarse 16 cost 51–70% of a full build; validation under 1 ms; cold round edge finishing (2.5–3.3 s) was paid again per segment count. On a slow device the accurate preview and export unlock arrived about 1.3–2.1 s later. The coarse request path, provisional state, worker coarse cache, Viewer/PreviewPanel provisional handling and the domain segments threading were removed; domain builders are code-identical to HEAD apart from comment cleanup. Quality tiers now change only DPR and shadow size, with `preview_quality` telemetry. DECISIONS 2026-11-04 entry updated.

Validation after the removal: `format:check`, `lint`, `typecheck`, `test:fast` (94 files / 731 tests), `build` pass; `test:e2e:journey` 9/9; recovery, preview-quality, keychain and export-recovery specs on desktop+mobile 88/88; `pnpm test:e2e:performance` 54/54. Firefox not run.

Desktop startup-budget flake (`performance.spec.ts:15`, budget 3000 ms) when the performance spec runs inside a parallel multi-spec invocation: reproduced on HEAD `ffcaaa3` too (3792 and 3969 ms) and passes at about 1.7 s alone or with one worker. It is parallel cold-start contention, not a regression; run the performance spec through `pnpm test:e2e:performance`.

## QA gates and adaptive preview quality, 2026-11-04

Uncommitted working tree on `main`; no commit, stash, worktree or push. Owner reviews and commits.

- Changes since 2026-11-03:
  - Landing idle prewarm: after load, a 1 s LCP-quiet wait, then requestIdleCallback; skipped on
    saveData and 2g; re-checks the route after the import.
  - Adaptive preview quality:
    - renderer tiers (DPR and shadow size);
    - coarse-first display-only builds (withdrawn later the same day, see above);
    - step down after 2 full builds over 2.5 s; step up after 5 builds under 1 s, with a 30 s
      cooldown on step-up only;
    - `preview_quality` telemetry (owner-approved);
  - `.claude/` added to `.prettierignore`.
  - Zero `//` line comment policy, enforced by the `local/no-line-comments` ESLint rule: 137
    comments were reduced to 49 compact `/* */` notes.
  - The validation-ci-workflow fixture now uses
    `scripts/validation/commands/__fixtures__/untested-source.ts`.
- Gate results from this run (no failures, so no reruns were needed):
  - `pnpm format:check`: pass.
  - `pnpm lint`: pass, no issues.
  - `pnpm typecheck`: pass (exit 0).
  - `pnpm test`: pass, 104 files / 1042 tests. The "Validation failed" lines in the log come from
    runner fixture tests, not real gate failures.
  - `pnpm build`: pass.
  - `pnpm test:e2e:smoke`: 6/6.
  - `pnpm test:e2e:journey`: 9/9.
  - Recovery, boot-recovery, export-recovery, quick-setup and preview-quality on desktop, mobile
    and mobile-2x (`--workers=1`): 105/105.
  - `pnpm test:e2e:performance`: 54/54.
  - `keychain.spec.ts` on desktop (`--workers=1`): 33/33. None of the four STATE.md pre-existing
    failures reproduced.
  - `pnpm validate:push`: refused as expected with "pre-push: commit or stash tracked changes
    before validation." (exit 1). It moved `.env` aside and restored it; `.env` is present.
  - Extra check, `playwright.preview-lifecycle.config.ts`: 6/6 fail. The 2026-11-03 "profile
    folder" symptom has changed to `browserType.launch: Executable doesn't exist`, a missing
    local Firefox binary (`.../firefox-1555/.../Nightly.app`).
- Known gaps:
  - Firefox and Safari preload reuse is unverified.
  - The preview-lifecycle Firefox environment issue is still present (missing Firefox Nightly
    binary on this machine).
  - No commit or push yet.
- Next steps: the owner reviews and commits; then a post-deploy PostHog re-check after about 7
  days.

## Autonomous run — /create cold-start and worker resilience, 2026-11-03

Uncommitted working tree on `main`; no commit, stash, worktree or push. Owner reviews and commits.

- Phase 0, probes: `e2e/performance.spec.ts` (51 tests, gated by `PLAYWRIGHT_PERFORMANCE`) adds:
  - CLS, LCP and FCP on `/` and `/create`; landing → setup CLS.
  - Cold and reload startup, plain and throttled (4× CPU, Slow 4G).
  - Ungated network tests: a single wasm/worker download on `/create`; none on plain landing.
- Phase 1, telemetry: `geometry_ready` stage timings and the `preview_rendered` event
  (owner-approved, DECISIONS 2026-11-03).
- Phase 2, geometry worker resilience (`geometry-worker.ts`, `geometry-client.ts`):
  - 45 s boot watchdog; per-request timers start at the FIFO head after ready.
  - Serial worker message queue.
  - At most 2 automatic replacements per rolling 60 s; each replacement re-requests the current
    design once.
  - `worker_replacements` telemetry; `getWasm` retries after a rejection.
- Phase 3, cold start: prewarm pool on `/create` link intent (lazy-loaded); `/create` prerender
  emits modulepreload for the worker chunk and preload for `/manifold-v1.wasm`.
- Phase 4, session replay: canvas capture throttled to 1 fps at 0.2 quality on coarse pointers.
- Phase 5, no product change: the in-app Suspense fallback is dormant under BrowserRouter
  useTransitions; a pill min-width change was tried and rejected visually.

Results (A/B, page clock, mobile emulation, throttled, n=5, clean HEAD vs working tree):

- Direct `/create` → Ready: 47.0 s → 38.6 s (median).
- Landing CTA → Ready: HEAD never reached Ready (5/5 runs ended on the recovery UI at the 120 s
  timeout); working tree 40.3 s (median).
- Unthrottled: unchanged (about 1.4 s / 1.1 s).

Validation:

- Lint, typecheck and build pass.
- `pnpm exec vitest run scripts/validation/commands/validation-ci-workflow.test.mjs`: 5/5 pass.
  The "empty static related-test selection" test now points `--source` at
  `scripts/validation/commands/__fixtures__/untested-source.ts`, which no test imports. The old
  `ControlsPanel.tsx` source became related through the new `useRoutePreload.test.ts` import chain.
- `pnpm test:fast` (post-fix): 90 files, 686 tests passed.
- Full `pnpm test` before the fixture fix: 972/973. The post-fix full-suite number was not re-run.
- E2E: smoke 6/6; journey 9/9; performance 51/51.
- Recovery + boot-recovery + export-recovery + quick-setup: 97/99. The 2 mobile-2x failures
  (`recovery.spec.ts:181` and `:232`) passed when rerun alone under lower load. Treat as
  load-related flake and watch them.
- Preview-lifecycle config: 6/6 fail at Firefox launch ("Could not find profile folder"). This is
  an environment issue on this machine.
- `format:check` flags only the gitignored local `.claude/settings.local.json`;
  `.prettierignore` does not exclude `.claude/`.
- `validate:push` refused because tracked changes are uncommitted (expected).
- Known issue: `pnpm validate:changed` without file arguments checks nothing, although AGENTS.md
  lists it as Gate B.

Not done:

- No commit or push.
- `capture:ui` not run (no UI change shipped).
- Renderer tiering deferred until field data arrives.
- The field CLS 0.12 cause is still unconfirmed in the lab.

Next: after deploy plus about 7 days, re-run the PostHog queries: cold vs warm by device,
`cold_start` / `worker_boot_ms` / `wasm_wait_ms`, `worker_replacements`, and CLS.

## Validation speed-up, 2026-11-03

Committed on `main` on top of `3d7b92d`; nothing pushed.

- Root cause of a "20+ minute" `pnpm validate:push`: it was hung, not slow. It read stdin to EOF
  whenever stdin was not a TTY; agent shells hand it a socket that never closes, so no gate ever
  started. Only the Husky wrapper (`pre-push-changed.mjs`) now sets `VALIDATION_PRE_PUSH_STDIN=1`;
  manual runs diff against the upstream merge-base. Verified: a manual run from an agent shell
  reaches the clean-tree check in under a second.
- `keychain-builder.styles-fonts.test.ts` sharded into one file per style plus the remainder
  (`keychain-builder-style-font-cases.ts` registers the per-style cases); the two
  `VALIDATION_FIXTURES` sweeps moved out of `geometry-contract.test.ts` into
  `geometry-contract.fixture-{solids,3mf}.test.ts`. Test names verified identical before/after
  (892 full / 605 fast via a collect-only run). `test:fast` excludes `keychain-builder.*.test.ts`
  by glob; `relatedInputsForCi` derives the builder suites from the directory.
- Concurrency (`scripts/validation/core/concurrency.mjs`): default is all but two cores (max 8) on
  large machines, unchanged `min(4, cores)` on small ones. Full Unit uses the whole budget,
  `unit:fast` and full Browser half (min 2). Matrix cap raised 5 → 8. CI pins concurrency to 1 and
  `PLAYWRIGHT_WORKERS` defaults to 2, so CI is unchanged.
- Matrix packages are scheduled longest-first from `node_modules/.cache/open-keychain-validation/
matrix/case-durations.json`; the heaviest 5% run singly. The summary lists `slowdowns` (>3× and
  ≥5 s over history).
- Measured on the 10-core M1 Pro (8 workers): full Unit 322 s → 96 s (`vitest`, 95 files / 900 passed);
  `unit:fast` 77 s → 36 s (612 passed); `pnpm validate` (ci) ~6 min → 2m26s, passed; full
  geometry matrix 22 min (4 workers) → 11m53s, 4,264 passed + 3 expected-invalid, 0 failed, peak
  worker RSS 0.9 GB.
- Slowdown report correction: the flagged `comforter-brush` wide/long-text cases (~22–24 s) are
  not a regression. Standalone timing is identical at every geometry commit from `ddba30e`
  (2026-10-13) to HEAD; the 2026-10-16 log used to seed history is not comparable. History now
  holds current values.
- Not done: profiling whether per-(font, text) relief work could be memoized across templates
  (plan step 5); `validate:full` browser timing (pre-existing e2e failures listed below would stop
  it under fail-fast).
- `CONTRIBUTING.md` rewritten to be shorter and task-oriented (same rules, 1,259 → 914 words).
- E2E regressions verified and fixed:
  - Product bug: clearing both Heart words returned `heart-empty`, which had no recovery-catalog
    entry, so users saw the generic "Something went wrong" text. Added `errorHeartEmpty`
    (EN/RU/UK) and the catalog mapping; the catalog guard test now also scans
    `invalidResult(...)` codes. Removed the unused `candidateRejected` locale key.
  - Stale tests: "Primary/Secondary" radios renamed "Name/Subtitle" (`5e72341`); NIKITA Bubble
    edited fields behind the export dialog, a native modal since `decf07c`; touch projects
    asserted fine-pointer-only hover feedback (`keychain.spec.ts`, `contrast.spec.ts`); Heart
    asserts "Fix this" offers "Edit this setting" (kept by user decision);
    `geometry-finish.spec.ts:16` (~22 s idle, 30 s limit) is `test.slow()`.
  - Full Playwright suite (desktop/mobile/mobile-2x, 4 workers): 516 passed, 3 skipped, 0 failed.
- Text edge finishing (`edge-finish.ts`) used an O(vertices x edges) distance scan in the band warp
  (16 of 26 s on `comforter-brush` `WWWWWWWW`). A uniform-grid index returns the identical minimum:
  mesh hashes identical on 7 representative builds; full matrix 4,267 cases with 0 outcome
  differences; slowest build 25.9 s -> 9.2 s, matrix 11m53s -> 9m0s. Remaining time is Manifold
  WASM; further gains would need coarser geometry (a product decision).
- Push gate: UI/browser changes (and conservative pushes) also run `pnpm test:e2e:regression`
  (`keychain.spec.ts` + `font-browser.spec.ts`, desktop, ~80 s). CI is unchanged.
- Local cleanup: build cache keeps the 3 newest artifacts (1.2 GB -> 95 MB); validation logs and
  browser outputs keep the newest 30 runs (pruning is skipped under Vitest so runner tests cannot
  evict real logs); old `artifacts/*` captures and `test-results` removed, `artifacts/release`
  kept.
- Final validation: uncached `pnpm validate` passed in 2m06s (unit 95 files / 903 tests);
  `test:e2e:regression` 42 passed; lint, typecheck, format:check pass.
- Not changed: typing into the editor behind the modal export dialog via automation reverts the
  name; real users cannot reach those fields.
- Next action: push when ready (`git push` runs the pre-push checks).

## Current work — code-review follow-up, 2026-11-03

Rebased onto `origin/main` at `140ef3b`; nothing from this run is pushed yet.

- 3MF separate-colors output adds `recommendedextensions="m"` on `<model>`. Verified against the
  3MF Core specification (`spec_core`, model attribute table and XSD): the attribute exists and takes
  space-delimited namespace prefixes; consumers lacking a recommended extension SHOULD warn the
  user, and Core consumers MUST ignore unsupported-namespace nodes. Unverified: how Core-only
  slicers or Bambu actually resolve `pid="10"` (PrusaSlicer is not installed here). A triangle
  `pid` can reference only one resource, so `basematerials id=11` is a declared but unreferenced
  fallback.
- `validate-slicers.ts` uses an attribute-order-independent parser (`three-mf-structure.ts`), checks
  the object-level `pid`, asserts merged output has no `m:colorgroup`, and prints the pending-slicer
  count. `generate-validation-fixtures.ts` reads slicers from `docs/slicer-compatibility.json`.
- `isRecoverableCandidateFailure` (`recovery-recipes.ts`) maps `text-edge-too-large` and
  `base-edge-too-large` to `rejected` (Fix popover); other failures stay `failed` (Retry only).
- The source-map gate is `scripts/validation/commands/check-sourcemaps.mjs`; it exempts only
  unmapped CSS-only JS stubs (the `customizerBootStyles` `/* empty css */` file, see `140ef3b`).
  The real GitHub Actions run has not happened.
- QuickSetup heading wraps again (`overflow-wrap: anywhere`); export choice CSS is deduplicated via
  `--export-choice-border` and `--export-choice-outline-offset`. Not visually inspected at 320 px /
  200% zoom / RU / UK.
- e2e: the edge-finish rejection test injects a structured `text-edge-too-large` failure.
- Validation after the rebase: desktop `quick-setup.spec.ts` and `keychain.spec.ts` 47 passed,
  4 failed. The 4 failures are pre-existing (identical on clean `ca0db9a`): NIKITA Bubble "Ready ·
  adjusted" status, Magnet ribbon and subtitle "Secondary" radio (2 tests), Heart "Your previous
  design is kept." alert. Mobile `keychain.spec.ts` failures (~193, ~226) were seen but not
  baselined. Not run after the rebase: `pnpm validate`, mobile / mobile-2x e2e, `pnpm capture:ui`.
- `AGENTS.md` and `CLAUDE.md` are intentionally local-only (listed in `.gitignore`, untracked).
- Next action: run `pnpm validate:push`, then push.

## Setup translation and mobile layout, 2026-10-29

- A translator-like replacement of the Next button text reproduces the route error during the
  Colors → Review transition. Stable label elements preserve the transition under this mutation.
  The supplied Android recording shows mixed translated and English text; its exact translation
  provider and reproduction on real hardware remain unverified.
- The setup dialog uses a compact landscape layout; its mobile tests cover the recorded sequence,
  translation-like mutation, both orientations and enlarged EN/RU/UK text. Known excessive text
  edge amounts are reported as rejected candidates rather than technical failures.
- Production CI checks PostHog source-map injection markers before upload and deploy. Actual
  source-map resolution of a new production exception remains to be verified after deployment.
- The first production build found one CSS-only JavaScript stub without a source map; the marker
  guard now checks mapped bundles and requires a main app map rather than rejecting the stub.
- Validation: `pnpm validate` passed on the release checkout, including all unit tests and nine
  critical browser journeys. Mobile setup passed 18/18; the translated-text regression passed in
  desktop, mobile and mobile-2x.

## Released — geometry reliability, 2026-10-25

- Candidate validation now recovers an exhausted worker on explicit Retry or one new edit per failed
  worker episode. Warmup-ready does not reset the automatic replacement budget; only a normal
  operation response does. Requests are not replayed, stale worker replies stay ignored, and disposed
  clients remain disposed.
- Technical candidate failures have a Retry state with structured diagnostics. Expected geometry
  rejection and measured parameter-limit correction preserve accepted params, fonts and geometry;
  parameter corrections are offered as explicit revalidated recovery options. Export eligibility is
  keyed to retained accepted geometry plus accepted params/fonts, so transient preview errors do not
  disable a still-valid accepted design.
- Added paired geometry attempt telemetry with accepted/rejected/error/superseded/cancelled outcomes,
  fixed operation/template/control IDs, structured failure code/stage/type, retry/recovery links and
  accepted geometry generation correlation. Updated allowlists and `docs/analytics.md`; old
  `geometry_error` events remain historical and new bundles no longer emit them.
- Randomization validation now emits one paired attempt per generated candidate validation,
  including subsequent candidates and measured-limit revalidation, so its outcomes join the same
  geometry funnel. Starting randomization closes an in-flight candidate attempt as superseded
  before invalidating its request ID.
- Validation: typecheck, full ESLint, `validate:changed`, production build, and `git diff --check`
  passed. Final focused geometry/customizer/export/telemetry coverage passed 60/60; strict journey
  reporter coverage passed 7/7. The configured browser journey passed 9/9 across desktop, mobile
  and DPR 2 Chromium contexts, including real-WASM STL plus both 3MF modes, exhausted-worker
  recovery, new-edit recovery, repeated exports and format changes. The journey reporter was aligned
  from its stale expected count of 6 with the actual 9-test configuration.
- `pnpm validate` reached 856/857 unit cases; the sole failure was the missing catalog entry for the
  new `geometry-worker-init-failed` code, now added and verified by the catalog test. The gate also
  reports Prettier on the pre-existing untracked user file `result.json` and cannot allocate its
  internal browser port in the sandbox. Targeted Playwright runs passed with approved localhost
  access. No Firefox/WebKit export journey was run.
- Geometry reliability was committed at `ca0db9a`, followed by CI log and workflow-test fixes at
  `105ffa1` and `8acce11`, and evidence-based geometry timing adjustments at `81795b4`. GitHub CI
  passed and the production site served the `81795b4` release SHA. The current task is the separate
  neutral-3MF/slicer slice below.
- Follow-up review fix: randomized attempt telemetry passed the focused customizer, randomizer, and
  telemetry suites (30/30), TypeScript, and targeted ESLint. The supersession interleaving regression
  then passed the customizer hook suite (11/11), TypeScript, and targeted ESLint.

## Current work — neutral multi-slicer 3MF, 2026-10-21

- Separate-color export carries a Materials Extension color group, Core materials, and Prusa named
  volumes in one aligned mesh, without printer/process settings. The export dialog recommends this
  format and provides localized collapsible filament-assignment and Bambu geometry-only guidance.
- Added a slicer compatibility manifest for seven application families plus Bambu Studio 2.8.4.57
  beta, expanded generated manual rows to 26 fixtures × 8 targets × 3 formats, and added
  `pnpm validate:slicers` structural checks plus the existing Prusa CLI gate.
- Local slicer validation: official macOS packages were checksum-verified and run from temporary
  storage. Bambu Studio 2.8.2.61, Bambu beta 2.8.4.57, and OrcaSlicer 2.4.2 each imported all 52
  generated 3MFs with `--info` (26 separate-color + 26 merged; all manifold). PrusaSlicer 2.9.6
  sliced 78/78 generated STL/3MF fixtures; all 26 separate-color exports round-tripped with named
  volumes and aligned bounds. `pnpm validate:slicers` passed structural ZIP/XML and Prusa CLI
  checks. Prusa emitted 24 nonfatal generic print-stability warnings; no repair, invalid/manifold,
  or path-conflict warning occurred. Bambu/Orca CLI `--export-3mf` attempts aborted (signal 6).
- GUI import/material assignment and exact slicer GUI round-trip remain unverified; the local UI
  automation surface exposes no native applications. Cura/Creality/Anycubic/Flash Studio were not
  validated: Cura requires GUI import, Creality's macOS CLI rejects `--info`, Anycubic was not
  acquired, and Flash Studio 1.7.15's bundled binary is incompatible with this Apple Silicon host.
  Exact versions and official installer SHA-256 values are recorded in `docs/slicer-compatibility.json`;
  all application statuses remain pending, with no complete compatibility claim established.
- On the user's narrowed request, reran Bambu Studio stable alone: all 52 generated 3MFs passed
  CLI `--info` import with manifold geometry. No GUI import/material assignment was possible because
  native app control is unavailable. Removed all temporary slicer downloads, extracted apps, data,
  and mounted images afterward; no slicer app remains installed by this run.
- Earlier validation remains: serializer tests 5/5, typecheck, lint, generated 26 fixtures, six
  critical journey/recovery browser cases across desktop/mobile/mobile-2x, and focused export-dialog
  browser coverage passed.
- Release preparation is based on `origin/main` at `81795b4`. In this run, serializer tests (5/5),
  typecheck, formatting, source ESLint, and the export-dialog browser case passed on Chromium desktop,
  mobile, and mobile-2x. The first lint command included unsupported Markdown/package paths and exited
  on ignored-file warnings; rerunning ESLint on source paths passed. A mistakenly broad Vitest
  invocation was stopped after it stalled in geometry contracts; the direct serializer test passed.
  Generated 26 fixture cases / 78 files; structural archive/XML checks passed. `pnpm validate:slicers`
  then failed at its external slicer phase because PrusaSlicer is not installed here. Earlier
  PrusaSlicer 2.9.6 CLI evidence remains documented above, but was not rerun. GUI import, assignment,
  slicing, and round-trip checks remain pending. Do not claim complete multi-slicer compatibility.

## Current work — automatic per-commit frontend release attribution, 2026-10-21

- `app_release` is derived as `<package.json version>+<full source SHA>` (or `+local` for a development build without Git metadata); manual `VITE_APP_RELEASE` overrides were removed. Routine pushes require no package-version bump.
- The durable release rule is in `docs/agent/DECISIONS.md`. Root `AGENTS.md` is ignored by `.gitignore`, so that local instruction file is not part of the tracked change.
- App and SDK events continue to receive bundle-bound `app_version` and `app_release`. Added deterministic release-label tests and extended provider coverage for forged release values.
- Validation: focused build/telemetry tests passed (40/40), `pnpm validate:changed`, typecheck, ESLint, Prettier, `git diff --check`, and production build passed. The built app bundle contains `0.1.0-beta.1+efa4062529dc72def1354195254655078cfe0cd7`, matching the source HEAD used for the build. The build used a dummy PostHog key and sent no events. No browser ingestion or live production traffic was verified.
- This implementation is based on `main` at `efa4062529dc72def1354195254655078cfe0cd7`; the user authorized a single commit and push of this change set. No live analytics traffic or browser ingestion was verified. Next action: after the production workflow completes, verify the documented per-event/day coverage query with fresh-client events.

## Current work — consented PostHog analytics and replay, 2026-10-20

- Expanded the consent-gated SDK to autocapture, dead clicks, Web Vitals/performance, console logs,
  unhandled errors/rejections, canvas/WebGL replay and unmasked editor inputs. Consent revocation
  clears queued events/errors and opts out; cross-tab changes are synchronized. React route
  boundary errors are captured separately from structured `export_failed` events. High-signal
  failures request a replay; baseline sampling is 100% based on 46 consented sessions in 30 days.
- EN/RU/UK consent and privacy copy now describes captured text, settings, preview, errors/logs,
  performance and 30-day retention; the privacy page includes persistent allow/revoke controls.
  Dashboard 902571 received export failure, Web Vitals, recordings, logs and error issue widgets.
  Current 30-day failure-stage/type fields are missing on existing records; new events should fill
  them. Survey was verified active but English-only with zero impressions, so no survey tile added.
- Production CI now generates hidden source maps, uploads by Git SHA to PostHog, removes maps before
  artifact publication, and fails clearly when `POSTHOG_CLI_API_KEY` is absent. Secret and live
  project sampling/billing controls remain external prerequisites; no release or deploy was run.
- Validation: targeted Vitest 19/19, typecheck, Prettier, `pnpm build`, and `pnpm validate:changed`
  passed. Browser visual verification and live source-map upload were unavailable/not run. Changes
  remain uncommitted on `main`; no commit/push/deploy was performed.
- Next action: add the `POSTHOG_CLI_API_KEY` GitHub secret and confirm replay trigger sampling,
  billing alerts, and no-paid-overage settings in PostHog before the first production release.

## Current checkpoint — granular commits and authorized push, 2026-10-20

- User approved committing all accumulated changes in four scoped Conventional Commits and pushing
  main, including the existing a916c2d checkpoint. This supersedes older authorization notes below.
- Created b1ab5a2 (Customizer/preview recovery), e8bebe3 (accessibility/Share), and a7ee521
  (export recovery/diagnostics/build SHA). Each staged snapshot independently passed typecheck;
  normal pre-commit ESLint/format checks passed. Fourth commit contains the required shipping gate
  and consolidated architecture/handoff notes. All existing working-tree changes are accounted for.
- Validation evidence for the complete implementation is recorded below. Final push will run the
  installed required journey and affected-code gates against the committed revision, without bypass.
- Next action: inspect the pushed revision's CI quality and production-artifact journey results.
  Push is authorized; no separate manual deployment command is authorized or planned.

## Current work — mandatory export/user-journey shipping gate, 2026-10-20

- User requires core export and a superficial full user flow for every change before push; existing
  export-recovery work and unrelated dirty edits remain intact. No history/remote/deploy mutation.
- Added required uncached `browser:journey` for push (including docs/test-only/empty tree diff),
  ci-changed (even no paths), standard and full profiles. Build prerequisite is deduplicated; missing
  pnpm now blocks the hook. Skipped critical verification fails. Remote branch deletion stays skipped.
- Added `pnpm test:e2e:journey`: landing → all six setup steps → Simple edit → visible WebGL model →
  actual STL/merged+separate 3MF → further edit/export, plus worker failure/retry. All three desktop/
  mobile/mobile-2x projects run. STL binary length/count and 3MF material/volume contracts are decoded.
- CI production-build now tests its exact Netlify artifact before upload/deploy. Required local
  checks force local preview even if PLAYWRIGHT_BASE_URL was inherited. Build cache inputs now cover
  build helpers, source HEAD and revision/context variables. No blanket full-matrix-on-every-change.
- Files: validation planner/executor/cache/inputs and tests, pre-push hook, package scripts, CI,
  Playwright blank-URL normalization, new critical-journey spec, CONTRIBUTING and agent decisions.
- Required journey uses strict reporter verification: exactly six ordinary passes, no skip/fixme,
  expected failure, partial collection, .only or retries masking failure. Reporter events carry the
  correct gate ID; reporter test fixtures do not leak synthetic failed cases into outer validation.
- Parallel verification exposed shared Playwright trace cleanup (ENOENT). Browser output is now
  isolated under artifacts/validation-browser/<run>/<gate>; changed-browser and related-unit worker
  counts obey the scheduler budget, avoiding CPU-driven fixture timeouts without increasing limits.
- Validation: full pnpm validate passed (83 files / 828 tests plus the six browser cases) before
  final strict-reporter/output-isolation refinements. Those deltas passed focused reporter/runner
  tests and the final change-based pipeline below. Documentation-only CI with a deliberately wrong
  external URL still built locally and passed all six cases. Missing-pnpm hook simulation failed
  closed as intended. Installed core.hooksPath is .husky/_. Independent review has no findings.
- Final pnpm validate:ci:changed passed in 45 seconds: format, typecheck, lint, build, related
  units, smoke, changed-browser and required journey. Focused coverage: 44 relevant unit tests;
  all six mandatory journey/recovery cases passed. Log:
  artifacts/validation-logs/2026-10-20T07-22-50.271Z-37694.log.
- Next action: review the completed local safeguards; run pnpm test:e2e:journey for a manual check.
  No commit, push or deployment is authorized by this task.

## Current work — export worker recovery, 2026-10-20

- Branch `main`, HEAD `a916c2d`, ahead one. All previous dirty work preserved; this slice is
  uncommitted. No commit, push, or deployment. Production still has the old exhausted-recovery
  behavior and an empty embedded version (verified during the preceding investigation).
- Incident: 28 distinct export attempts, each with one start/one failure, 15 STL and 13 3MF,
  rejected in 6–11 ms in one Articulated name session following two validation timeouts.
  Local/browser fault injection confirmed exhausted recovery makes the same client reject forever.
  The initial production hang remains unconfirmed: no model parameters/exceptions and no Replay scope.
- Explicit export/preview Retry now re-arms an exhausted client once without replaying old work.
  Healthy clients are retained; disposed clients cannot restart. Warmup failures settle pending work;
  eager unhandled WASM initialization is removed. Request IDs stay monotonic, stale workers ignored,
  cached geometry survives real buffer transfers. Export has a synchronous duplicate-action guard.
- Export telemetry adds fixed `failure_stage`/`error_type` fields with strict allowlisting and keeps
  existing error codes. SHA resolution validates GITHUB_SHA/VITE_APP_VERSION/COMMIT_REF then Git HEAD;
  CI passes VITE_APP_VERSION and production without any SHA fails. An analytics-enabled production
  artifact was inspected and contains the expected HEAD SHA; no real analytics were sent.
- Files: geometry client/worker + tests and worker response type; shared operation-diagnostics;
  export-actions hook with new tests; geometry-generation hook with retry regression; telemetry
  allowlist and tests; build-version helper and tests, Vite and CI; e2e/export-recovery.spec.ts;
  docs/analytics.md. Existing RecoveryNotice is reused; docs/design-concepts.md was checked.
- Validation: 538 fast tests passed; changed-file format/lint, standalone full format/lint,
  typecheck, production build passed. Existing EN STL / RU 3MF keyboard workflows passed on all three
  viewports (6 cases). New fault → exhausted recovery → Try again → STL/merged+separate 3MF/STL
  passed on desktop/mobile/mobile-2x (3 cases). Second messageerror is injected by calling the
  app-installed handler: Chromium synthetic dispatch did not invoke it. Physical device/OS worker
  termination was not tested. Full unit: 83 files / 825 tests passed. Final `pnpm validate` passed
  (format/lint/typecheck executed, successful unit/build cache reused); first aggregate run caught
  temporary E2E diagnostic formatting/lint, which were removed and rechecked. Final log:
  artifacts/validation-logs/2026-10-20T06-57-39.194Z-6760.log. Independent review has no remaining findings.
- Next action: review this local slice; release separately only with explicit authorization, then
  check version coverage, one terminal event per attempt, recovery success and repeated fast failures.

## Current investigation — social design-payload audit, 2026-10-19

- User reported an empty authenticated Facebook composer. Rechecked actual local design URLs in
  clean Google Chrome: Telegram/WhatsApp display the complete URL, X login redirect preserves it,
  Facebook stops at its login gate. No authenticated posting/composition proof is available.
- Local source URLs contain `localhost`, which remote recipients cannot use. Asked whether the user
  shared from local development or the public site; this remains unconfirmed. Do not label this as
  the confirmed cause of their screenshot. Public site successfully restored a nondefault v11 design.
- Strengthened social browser assertions to decode every payload and compare origin, locale and
  text. Final Chrome: 3/3 passed; changed-file format/lint and diff check passed. No runtime changes,
  commit or push. Existing toast/recovery/performance work preserved.
- Next action: use the user's source-page answer to reproduce Facebook with a public design URL;
  distinguish URL attachment from post-body prefill and do not claim success from HTTP status alone.

## Current work — copy-link toast and social destinations, 2026-10-19

- Added shared `NotificationToast`: bottom-centered success card, check icon, localized title/paste
  instruction, 44px dismissal, message-only polite live region and no focus movement. Six-second
  auto-dismissal pauses during hover/focus; reduced motion removes entrance animation. Narrow
  descriptions span the full card, and icon-only dismissal retains its 44px size at doubled text.
- X now uses the documented `https://x.com/intent/tweet`. Direct clean Chrome requests returned 200
  for all four destinations: Telegram/WhatsApp showed the example URL, Facebook reached login,
  X's intent route responded but its composer did not render in the automated session. No sign-in
  or posting. Sources and limitations are recorded in `docs/customizer-accessibility-review.md`.
- Validation: four social URL unit tests passed. Chrome contextual-action coverage: 18 cases passed
  in the first run; three new localized cases initially failed because a test helper expected English
  Ready text. Corrected to locale-independent readiness. Final focused run: 9/9 passed, including
  all locales at 320px/doubled text, centered placement, focus preservation, hover/focus timeout pause,
  dismissal and encoded social links. Final compact-icon layout rerun: 3/3 passed.
  Build/typecheck/full lint/changed-file gate/diff check passed.
- No commit or push. All pre-existing recovery/performance/preview work remains intact.
- Next action: open Share → Copy link to inspect the new confirmation.

## Current work — Chrome accessibility and responsive audit, 2026-10-19

- Branch `main`, HEAD `a916c2d`, ahead one; all earlier performance/recovery/preview work preserved.
  This audit is uncommitted. No commit, push or deployment was performed.
- Fixed contrast/focus, instance-specific font tabs and scoped keyboard navigation, message-only
  live regions, named localized groups, 44px recovery targets, forced-color Photo selection,
  doubled-text wrapping, nonshrinking stacked preview/controls and scrollable failed-preview actions.
  Unavailable previews no longer consume arrow keys as camera shortcuts.
- Google Chrome 152 through Playwright: new accessibility suite 21/21 passed; font tab/locale/tablet
  regressions 9/9 passed. Three stale online-font copy assertions failed in that combined run;
  updated to the centralized alert copy and rerun 3/3 passed. Earlier scoped Photo/Share/recovery
  checks and font/finish layout checks passed. axe-core 4.14 sampled 30 states: zero reported
  WCAG-tagged violations and no page overflow. Desktop/mobile/mobile-2x screenshots inspected.
- EN/RU/UK, 320px, tablet/landscape, doubled root text and text spacing, reduced motion, forced
  colors, keyboard focus and unavailable renderer recovery covered. No VoiceOver/physical device run.
- Build, typecheck, full lint, explicit-file changed validation, diff check and 20 focused units passed.
  Review details: `docs/customizer-accessibility-review.md`; browser logs/artifacts `/private/tmp/ui-*`.
- Next action: open `/create` and check Photo/Share and recovery with your preferred browser/text size.

## Current work — blank preview lifecycle repair, 2026-10-19

- Branch `main`, HEAD `a916c2d`, still one commit ahead of origin. Preserve the accumulated
  uncommitted performance and recovery slices below. This repair is uncommitted; no push/deploy.
- Reproduced the screenshot on the development server: ready/current generation with zero backing
  pixels and no JS error. Strict Mode cleanup before geometry saved camera/target at the origin;
  restoration collapsed the camera into its target. Home restored 17,763 backing pixels.
- Fixed cleanup to save only a validated installed-model inspection snapshot. Restore orientation,
  zoom and pan by fitting current bounds; unfitted setup starts at Home. Renderer session and
  installed-generation lifecycle states now govern readiness, stale callbacks and Photo availability.
  Context/render failure stops frames, revokes capture, and restarts once per mounted editor;
  subsequent failures expose Try again/Reload. Explicit retry replenishes the restart allowance.
- Validation: 38 focused unit tests passed. Production Chromium: 45 scoped checks passed across
  desktop/mobile/mobile-2x (surface/framing, lifecycle, recovery, actual model pixels, real WebGL
  context loss, bounded retries, thrown model draws and context loss during pending edits).
  Development Chromium: 12 lifecycle checks passed on desktop and mobile, including actual model
  draw exceptions and context loss during a pending edit. Independent review found no material issues.
  Build, typecheck, full lint, changed-file format/lint and diff check passed.
- Firefox was installed and attempted in both dev/production. It fails before page load: headless
  startup cannot open its temporary profile, and headed startup reports a macOS sandbox extension
  Operation not permitted. These are validation-environment failures, not app results; Firefox
  acceptance remains unverified. Dedicated config: `playwright.preview-lifecycle.config.ts`.
- Evidence: `/private/tmp/keychain-blank-chromium-initial.png` and `keychain-fixed-dev.png`;
  browser artifacts/logs `/private/tmp/preview-*`. Final `test:fast`: 77 files / 512 tests passed
  in 77 seconds. Final format, lint, typecheck, build and changed-file gates passed.
- Next action: reload `http://localhost:5173/create` in the user's Firefox and confirm the model is
  visible immediately. No camera interaction should be necessary.

## Preserved recovery slice — explicit Customizer recovery, 2026-10-19

- Branch `main`, HEAD `a916c2d`, one commit ahead of origin. The approved recovery plan is
  implemented alongside the previous uncommitted performance slice. No commit, push or deployment
  is authorized for these slices; preserve all current changes.
- Central stable-code catalog, sanitized structured worker errors and EN/RU/UK explanations/steps
  cover geometry, fonts/providers/files, setup, randomization, preview, export, Photo, Share and
  malformed links. Shared `RecoveryNotice` keeps diagnostics in a native disclosure. Inventory and
  extension contract: `docs/customizer-recovery.md`.
- Failed candidates retain requested parameters/fonts without replacing accepted geometry. Fix this
  validates at most two repairs lazily, sequentially in a separate disposable worker. Only verified
  printable proposals can be applied. New edits/close/unmount cancel background work. Stale request,
  parameter and font identity guards protect application; background results receive unique main
  client generation ids. Undo fix restores the prior accepted design.
- Font/edge recovery preserves the requested font with a measured smaller edge or sharp edges.
  Recovery is inline in the font dialog and anchored in the editor. Feature-owned operational
  retries/fallbacks reuse the same notice. Superseded preview work is ignored, not reported as failure.
- Validation: 41 focused recovery/hook/client/Photo tests passed; 26 focused real-geometry cases
  passed. Thirty browser checks passed across desktop/mobile/mobile-2x: requested font + smaller or
  sharp edge + Undo, cancellation without blocking edits, EN/RU/UK 320px doubled-text popovers,
  photo encoding fallback, preview retry, Share clipboard/manual flow, Photo focus/layout and
  rejected/obsolete candidate preservation. Desktop/mobile and narrow localized captures inspected.
- Final complete unit/geometry run: 80 files, 790/790 tests passed in 5m22s, with no competing
  browser suite. Build, lint and formatting passed. The aggregate command retained its initial
  typecheck failure from the canvas browser fixture; that annotation was fixed during the run and
  standalone `pnpm typecheck` passed afterward. Changed-file formatting/lint and diff check passed.
- Initial full gate: 788/790 passed; two real-geometry tests exceeded their unchanged 5-second
  timeout while browser work competed for CPU. Both passed in isolation. The isolated full rerun passed all 790 cases. An added browser fixture required an explicit canvas `this`
  type; corrected and standalone typecheck passed. RU/UK formatting was corrected.
- Evidence: `/private/tmp/keychain-recovery-final`, `keychain-recovery-localized`,
  `keychain-recovery-operations`, `keychain-recovery-retry`; logs `/private/tmp/recovery-*.log`.
- Next action: reproduce the font/edge conflict in `/create`, choose Fix this, apply the smaller
  edge, and verify Undo fix. Real-device testing remains separate from emulated browser checks.

## Preserved performance slice — preview update latency, 2026-10-18

- Branch `main`, HEAD `a916c2d` (`feat(customizer): polish contextual photo and sharing actions`),
  one local commit ahead of origin. The user explicitly requested the current-state commit, then
  approved the performance plan. The reviewed UI checkpoint is committed; nothing was pushed.
- Implemented immediate discrete dispatch, 100 ms text debounce and leading/32 ms coalesced range
  edits. `GeometryClient.validateCandidate` keeps one real active build and one latest queued
  candidate, with typed supersession; independent validation/export semantics remain unchanged.
  Candidate acceptance, limit reconciliation, rejection rollback and camera framing are preserved.
- Local diagnostics now cover input/dispatch/validation/acceptance/render timestamps, queue duration
  and client/worker cache hits. Cached results no longer report original build durations. Production
  telemetry payloads are unchanged. The latency test records 30 warm edits per interaction category.
- Validation so far: final build/typecheck, full lint, changed-code gate and diff check passed;
  24 focused scheduler/client/worker/hook tests passed. Eight performance browser scenarios passed
  on desktop/mobile (range, discrete, typing, rapid burst). Rejection/latest-candidate/Strong checks
  passed across desktop/mobile/mobile-2x (nine final passing checks in two focused runs).
- Initial browser tests needed timing-aware updates: immediate rejected choices roll back before
  Playwright `check()` can assert the transient state; use click plus rollback assertions. The stale
  rejection fixture now releases the active response before expecting the queued candidate to finish.
- Independent review found no functional issues. A queue-to-cache timing edge was fixed and tested.
  The queue-to-cache regression now asserts an exact 75 ms queue duration with a fake clock.
- Full `pnpm validate` passed in 5m32s: typecheck, lint, build, format and 767 unit/geometry cases.
  Final targeted tests include the subsequently added hook/queue-metric coverage (24 passed).
  Final build/typecheck, full lint, changed-code and diff checks passed after diagnostics refinement.
  Two additional desktop/mobile browser checks validate the input-to-ready-commit metric.
- Isolated before/after comparison, 30 warmed edits per category/device, same event-to-DOM-generation
  observer and no competing tests (milliseconds, median / p95):

  | Interaction | Desktop before → after        | Mobile before → after         |
  | ----------- | ----------------------------- | ----------------------------- |
  | Range       | 298.2 / 325.0 → 178.3 / 197.4 | 139.6 / 162.2 → 29.4 / 46.4   |
  | Discrete    | 300.8 / 317.9 → 190.6 / 206.1 | 299.3 / 322.9 → 183.0 / 194.7 |
  | Text        | 309.0 / 318.1 → 291.4 / 316.5 | 303.2 / 324.9 → 280.1 / 294.2 |

  Sampled first uncached edits did not regress: desktop range 1104→978, discrete 644→531,
  text 1251→1245; mobile range 917→821, discrete 628→537, text 1232→1219 ms.
  Desktop range/discrete median reductions are 40%/37%; mobile 79%/39%. Text improves 6–8%,
  retaining its 100 ms debounce. These are local headless Chromium/emulated viewport measurements,
  not real-device results or guarantees for all parameter/template combinations.

- Evidence: `/private/tmp/keychain-full-edit-baseline.json`, `keychain-full-edit-optimized.json`,
  `keychain-optimized-edit-report.json`, `keychain-ready-commit-report.json` and
  `keychain-preview-trace.json`. The trace shows ~160 ms software-GPU/compositor tasks on the
  desktop preview after draw submission. The final ready-state metric includes that delay;
  draw submission alone (often 10–20 ms warm) must not be reported as full update latency.
  GPU completion/physical screen presentation is not directly measured.
- UI checkpoint evidence remains under `/private/tmp/keychain-popup-brand-jpg-review`,
  `/private/tmp/keychain-photo-naming-review`, `/private/tmp/keychain-share-width-review`.
  Current focused UI captures are under `/private/tmp/keychain-candidate-acceptance-review`;
  inspected Strong selection remains correct on desktop/mobile. No tracked showcase captures changed.
- This performance slice remains uncommitted alongside the recovery implementation. No push/deployment.

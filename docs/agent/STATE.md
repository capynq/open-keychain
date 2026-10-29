# Agent handoff

## Current work — setup translation and mobile layout, 2026-10-29

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

# Agent handoff

## Current work — 2026-10-18

- Starting branch `main`, HEAD `8972e8f`, clean and synchronized with origin. User requested the
  approved compact Photo/Surface/Share popup plan; this request authorizes edits/checks, not a new
  commit or push. Previous release authorization applies to its completed checkpoint only.
- Completed shared portaled, non-modal Photo/Surface/Share popovers and typed button/link rows.
  Photo no longer expands below the viewer. Capture and share hooks guard duplicate/stale/unmounted
  work; download success closes Photo, copying/native success closes Share, and recovery stays inside.
  Surface selection/reset behavior and accepted-state design serialization are preserved.
- Validation: frozen-lockfile install, build/typecheck, full repository lint, changed-code formatting/
  lint and diff checks passed. Fifteen focused unit/contract tests passed. Eighteen browser workflow
  checks passed on desktop/mobile/mobile-2x; six final Photo/localized layout checks also passed after
  fixing PNG wrapping at doubled text. EN/RU/UK, 320px, 200% text, keyboard focus/Tab/Escape,
  no-reflow bounds, PNG downloads, native-share success/cancellation (mocked), copy fallback and
  accepted-design edits are covered. External social composers were checked as encoded links only.
- Independent review: no remaining material findings. Saved Photo/Share and localized screenshots
  were inspected under `/private/tmp/keychain-popover-review` and
  `/private/tmp/keychain-popover-final-visual`; tracked showcase assets were not regenerated.
- Follow-up polish is implemented: reversible pointer popup presence, colored action wells,
  official Simple Icons social artwork/colors, and typed PNG/JPG export (PNG default, JPEG quality
  0.92). Existing PhotoCaptureApi.capture(longEdge) remains PNG; optional format adds JPG.
- Follow-up validation: frozen install, build/typecheck, full lint, changed-code gate and diff check
  passed. Eighteen unit/contract tests and 21 browser checks passed. Browser checks cover both formats
  at 1024/2048/4096, branded SVG colors, pointer open/close/reversal, live reduced motion, instant
  keyboard behavior and localized 320px doubled-text layouts on desktop/mobile/mobile-2x. Independent
  review found no material issues. The earlier 15/18/6 counts describe the preceding popup version.
- Final desktop/mobile/mobile-2x screenshots were inspected under
  `/private/tmp/keychain-popup-brand-jpg-review`. No tracked captures were regenerated.
- Latest follow-up: PNG/JPG segments now fill the action width equally; photo filenames use accepted
  text, template, applicable style and resolution, preserving Unicode names and bounding their length.
  Filename metadata is captured before asynchronous rendering so later design edits cannot rename an
  earlier image. Templates without backing styles omit the retained style value.
- Latest validation: 11 focused filename/download tests, build/typecheck, full lint, changed-code gate
  and diff check passed. Nine browser checks passed across desktop/mobile/mobile-2x, covering equal
  selector alignment, PNG/JPG names at all resolutions, focus/no resize and EN/RU/UK 320px doubled
  text. Desktop/mobile captures inspected under `/private/tmp/keychain-photo-naming-review`.
- Share-width follow-up: shared popovers support opt-in content sizing; Share now fits its longest
  action instead of inheriting Photo's fixed width, with the existing viewport/maximum-width cap.
  Build/typecheck, full lint, changed-code gate and diff check passed. Compact desktop/mobile captures
  inspected under `/private/tmp/keychain-share-width-review`. Nine browser checks passed across
  desktop/mobile/mobile-2x: compact width, social/native actions, clipboard recovery and localized
  320px doubled-text layouts.
- Backing-strength fix: exact preset comparison misclassified normalized 0.6 mm values
  (0.6000000000000001) as Custom. Numeric preset matching now permits only 1e-9 rounding noise;
  genuinely different values stay Custom. Regression failed before the fix and passes afterward.
- Strength validation: seven focused preset/edge-model tests, build/typecheck, full lint,
  changed-code gate and diff check passed. Three browser checks passed on desktop/mobile/mobile-2x
  for Strong after real Chamfered/Rounded geometry acceptance; desktop/mobile selected-state captures
  inspected under `/private/tmp/keychain-strength-verified`. Initial browser attempts had test-only
  hidden-input/relative-locator issues, corrected by clicking the visible Strong label.
- Working tree contains the uncommitted popup slice and backing-strength fix. No commit, push or deployment performed.
  Next action: review Strong backing selection and Photo/Share at `http://127.0.0.1:5198/create` before a scoped release.

## Release checkpoint — 2026-10-18

- User explicitly authorized committing the current state and pushing `main`, including its two
  existing local commits. This checkpoint supersedes earlier no-commit/no-push handoff instructions.
- Scope: input-aware motion, full hover/state polish and audit, bounded font discovery, live camera
  reduced-motion handling, and solid wood/metal surfaces with clipping-safe, surface-independent
  model framing. Starting HEAD before this checkpoint: `483e749`.
- Current gate: changed-code formatting/lint passed for every modified/new file; 26 focused unit
  tests passed. Latest build/typecheck passed during the framing fix. Nine surface browser checks
  passed at 100%/244% zoom across desktop/mobile/mobile-2x. Final hover/motion browser run
  passed 30/30 across the same profiles, including the previously deferred hover/state regressions.
- Known limitation: the pre-existing UK 320px/200%-text setup wrapping issue remains; full geometry/
  release matrix and tracked capture regeneration were not run for this UI slice.

## Current checkpoint — 2026-10-17

- Branch `main`, HEAD `483e749` (`feat: photo mode`), ahead of origin by two commits. This run's
  motion fixes are uncommitted; no commit/push authorized or performed. The starting tree was clean.
- Keyboard focus/pagination/rail/Pro navigation is instant. Pointer navigation may scroll smoothly.
  Shared icon transforms require hover/fine-pointer support everywhere; keyboard press movement,
  template image zoom, step slides, strength entrances, and toast entrances are removed.
- Pointer setup entry is 200ms without overshoot. Discovery aligns instantly and reveals only up to
  three new visible cards in at most 260ms, once per batch. External focus, keyboard, navigation,
  context/preference changes, and unmount cancel reveals; owned focus recovery keeps its card still.
- The viewer observes reduced motion initially/live and removes inertia without changing pose,
  target, or magnification. Public OrbitControls APIs flush residual rotation/pan; change handling
  is suppressed during that synchronous transaction. Photo/export behavior is preserved.
- Validation: frozen-lockfile install, build/typecheck, repository lint, changed-file formatting/lint,
  and 15 focused unit tests passed. The final motion + Simple-editor browser run passed 33/33
  across desktop/mobile/mobile-2x, including large touch hover and discovery replay prevention.
  Six further browser checks passed: localized EN/RU 320px/200%-text setup, native export,
  Photo download, and two shared-icon checks. UK fails because “Розташування” wraps within a word;
  the identical failure was reproduced on unchanged HEAD `483e749` in a temporary archive.
  Command: `playwright test e2e/quick-setup.spec.ts --grep 'enlarged text: uk' --project=desktop`.
  This pre-existing layout issue remains outside the motion slice.
- CUA reports no connected browsers, so visual feel/device performance has not been independently
  inspected. Tracked showcase images were not regenerated; capture setup now disables camera
  inertia as well as CSS motion. No full geometry/release validation was run for this UI slice.

## Button feedback refinement — 2026-10-17

- User feedback: some controls lacked movement and the response was too fast. Pointer hover was
  suppressed after keyboard use until clicking; mouse/pen movement now restores pointer modality
  without changing focus or writing attributes on every move. Touch movement does not enable hover.
- Hover feedback uses 200ms strong ease-in-out; presses use 160ms strong ease-out. Added missing
  button transitions/press feedback to camera, surface, Photo-resolution, and Simple text actions.
  Keyboard/reduced-motion controls remain immediate. Existing motion work stays uncommitted.
- This follow-up passed build/typecheck and 3 focused modality/token unit tests. Prior-run browser
  evidence above predates it; the mouse-return browser regression was extended but not rerun.
  Tracked captures and broader browser validation await the user's visual acceptance.

## Complete hover and interaction-state audit — 2026-10-17

- Reviewed all 66 application CSS files; 19 contain hover declarations. The complete selector
  inventory and decisions are in `docs/hover-interactions.md`. The expanded audit also includes
  active, focus, checked/selected, expanded, disabled/busy, and status states. Font-preview loading on
  mouse hover remains unchanged.
- Filled base transitions for swatch/hardware borders, font filters/provider/recovery controls,
  preview appearance/surface colors, rail colors, shared account/language/consent/header controls,
  landing carousel arrows/GitHub, and public resource links. Public control timing is aligned; the marketing-carousel hover remains 360ms.
- Press feedback uses 160ms; control transforms/selection colors use 200ms, with native availability
  and status/error messages immediate. Added custom checked-indicator/color transitions and surface
  expansion chevron feedback; keyboard/reduced-motion changes remain immediate. Setup progress
  colors transition, while its width no longer animates layout.
- Removed shadow interpolation, gated hover movement, kept public keyboard focus spatially stable,
  and restored static baseline transforms under reduced motion. Color feedback remains available.
- Added `e2e/hover.spec.ts` regression sources for reduced-motion baseline decoration, focus rings,
  large touch layouts (including carousel presses), and input-aware surface expansion. They have not
  run; visual approval/capture and browser gates remain pending.
- Hover-audit static gates passed. Expanded state-audit build/typecheck and 3 focused
  modality/token tests passed. Changed-code formatting/lint and diff checks passed after the final
  carousel touch fix. Browser regression sources remain unrun for this audit. Keep all earlier
  session changes uncommitted.

## Display-surface inspection repair — 2026-10-17

- Preserved prior uncommitted motion work. Follow-up scale correction: fit and pan use model bounds
  for every surface; scenery no longer pulls the camera back. The active board scene still caps
  the near plane at 0.1 mm so the large floor is not sliced by the model-only near limit.
- Follow-up user correction: removed angle-based board/floor fading. Both remain solid through
  camera rotation, including behind the lettering. Full orbit remains available; underside views
  naturally show the board instead of the keychain. Removed the superseded fade helper/tests.
- Corrected persistent-board behavior passed build/typecheck, changed-code checks, 12 camera/
  inspection unit tests and 6 focused browser regressions (desktop/mobile/mobile-2x). The first
  wood pixel assertion misclassified brown wood as red backing; inspected screenshots, corrected
  the classifier and added an above-view positive control before the passing rerun.
- Added screenshot-measured framing regression: matte/wood/metal/reset retain backing bounds
  within 1 pixel at 100% and 244% zoom on desktop/mobile/mobile-2x. Nine browser checks passed
  after the model-only fit correction; build/typecheck, changed-code checks and 12 camera unit
  tests also passed. Solid underside occlusion coverage remains.
  No tracked capture assets or commits produced.

## Next action

Verify the pushed checkpoint and normal remote CI. Tracked desktop/mobile/mobile-2x capture
regeneration remains a separate visual-review action.

## Current checkpoint — 2026-10-16

- Branch `main`, based on `ddba30e`. The user authorized committing the current changes and
  explicitly said not to push. This checkpoint and the accumulated UX, geometry, referral, test,
  docs and capture changes are included in that requested commit. No push or manual deployment.
- Locked dependencies installed successfully. Use the existing project runner for repeat checks;
  do not repeat the 44-minute geometry matrix for documentation, asset, or narrow CSS-only edits.

## Implemented and reviewed

- Simple/Pro modes, compatible parameter presets, native font chooser, category-led three-font
  pages, wrapping page dots, sequential discovery animation, Plus discovery with provider checks
  and offline fallback, shared preview-face loading, exhaustion/focus recovery, and contextual Pro
  scrolling/focus. Font discovery uses request tokens, including A → B → A safety.
- Shared solid color squares, independent resets, connected Template/Style group, independent
  backing/text finishes and strengths, aligned Pro sliders, bigger labelled Export, removed
  Customizer footer, shared Workshop tokens, and proportional ultra-wide workspace scaling.
- Safe-fit-independent 0.25–4× inspection zoom and bounded pan; camera retention and fit/home
  behavior. Zoom readout has an opaque contrast pair (11.98:1). Nameplate hidden roots are clipped
  to the plate bottom. Preview/validation worker requests omit export meshes and separate cache
  quality from export; startup timings remain local diagnostics.
- Shared step-aligned parameter constraints fix slot length, magnet/ribbon radius, ribbon notch,
  halo, ring offset and joint boss dependencies. Measured Nameplate radius/Plant shoulder caps
  reconcile and revalidate manual/random candidates. Initial/restored requested values preserve
  the approved compatibility policy until edited. Stale caps do not constrain pending geometry.
- Regression review fixed 320px/enlarged-text picker-target overlap and tall-desktop caption
  clipping. Caption height is content-driven; ultra-wide containment is tested. Independent source
  reviews found no remaining scoped blocker after async/randomization/stale-cap fixes.
- EN/RU/UK setup copy names the keyring opening and hole position, identifies model size limits,
  and calls the font choices categories. Pro font controls identify the name/subtitle text target.

## Validation actually run

| Check                          | Outcome                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Full unit suite                | 65 files / 721 tests passed                                                                               |
| Full geometry/export matrix    | 4,267 cases: 4,264 valid, 3 expected-invalid, 0 unexpected failures; 43m56s                               |
| Full public browser matrix     | 375 passed / 3 skipped; desktop, mobile, mobile-2x                                                        |
| Hosted workspace mocks         | 2 passed                                                                                                  |
| Development boot/handoff       | 6 passed                                                                                                  |
| Dedicated performance          | 12 passed; startup, idle rendering, repeated edit timing across all viewports                             |
| Smoke                          | 9 passed across all viewports                                                                             |
| Responsive captures            | Desktop/mobile/mobile-2x plus ultra-wide reviewed; 4 passed / 2 desktop-only skips                        |
| Late ultra-wide CSS correction | Caption capture passed; tall font visibility + boot/live parity: 2 passed                                 |
| Static/build                   | Format/lint/typecheck and production builds passed before final documentation refresh; final checks below |
| Locale clarification follow-up | All locale JSON parses with matching top-level keys; Prettier passes; 5 focused Quick Setup tests pass    |

- Initial browser failures were obsolete selectors/expectations and consent-panel interception in
  isolated workflow tests; consent-specific coverage remains intact. Parallel commands briefly
  shared/deleted trace files; subsequent commands use isolated output directories. Final browser
  gate is green. Logs live under ignored `artifacts/validation-logs/`.
- Default ALEX/Nunito backing/text maxima pass both full builds and real browser End-key tests,
  including unequal/symmetric backing amounts. The original user-observed rejection was not
  reproduced; do not claim its specific root cause was fixed. Ask for exact state if it recurs.
- PrusaSlicer is not installed. These software checks do not establish physical-print readiness.

## Portfolio referrals

- Exact allowlisted portfolio campaign maps to fixed `acquisition_source: portfolio` after consent.
  Before consent it stays only in memory; consented tab session storage survives refresh; decline
  clears it. Raw UTM/referrer/person capture remains disabled and scrubbed. EN/RU/UK consent copy
  and focused tests are included. Full unit validation above includes this slice.
- After deployment, verify a consented production referral and filter activation by portfolio,
  production environment and non-internal traffic. No live PostHog mutation was performed.

## Remaining product planning

- Keep the 63 complete starting-look recipes/thumbnails and exhaustive parameter disposition
  matrix in the plan; they are not implemented by this checkpoint. Real-device gesture testing,
  comparative cold/warm startup traces, and physical printing remain separate acceptance work.
- Public/profile token migration stays a later slice. See `PLAN.md`, `BACKLOG.md`, and
  `PARAMETER-AUDIT.md` for remaining scope and limitations.

## Next action

Verify the resulting commit and clean working-tree status. Do not push; the current user instruction
explicitly limits authorization to a local commit. The validated public preview is running at
http://127.0.0.1:4193 (owned session `62485`).

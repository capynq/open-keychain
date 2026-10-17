# Agent handoff

## Current checkpoint — 2026-10-17

- Branch `main`, HEAD `5e72341`; the worktree contains the Customizer Workshop refresh awaiting the
  user-authorized local commit. Do not push.
- Export choices now use icon-led cards in a native dialog; print facts use accepted geometry
  metrics and the preview surface picker uses Lucide. Export formats and geometry are unchanged.
- Prior handoff reported `pnpm typecheck`, `pnpm lint`, and `pnpm build` passing. This run passed
  formatting, focused ESLint, `git diff --check`, and five focused desktop browser checks for
  localized export, dialog keyboard behavior, and print facts. A broader two-spec run had 35
  passes and 14 failures in additional flows; those failures were not confirmed against a clean
  baseline.
- The user approved the visual direction. The native dialog test now checks `::backdrop`, explicit
  focus wrapping, Escape, and focus return. Print-facts labels wrap at narrow widths and 200% text.

## Next action

Commit only this Workshop refresh locally as `style(customizer): refresh export and preview
summary`, then implement Photo mode and realistic oak/satin-metal boards as a separate change. Do
not push.

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

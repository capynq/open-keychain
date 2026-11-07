# Open Keychain decisions

## Keyring openings are placed by position and proven clear

**Status:** active

**Decision:** An articulated name carries its keyring on the letter that matches the position:
the first letter for left and top left, the last for right and top right, and the letter nearest the
middle of the chain for top and bottom. Every builder path keeps the cut opening and the builder
rejects a design with `keyring-opening-blocked` when backing, raised text, subtitle, another
articulated letter or a connector covers it. Before that check, the ring moves straight out from its
anchor until the opening clears the body (0.5 mm steps, then bisection); the hull keeps the longer
tab joined. Diagonal positions scan 10–90% of the rotated side instead of 24–76% so corners of
wide plates qualify, and equally good extremes (both ribbon tail tips) resolve toward the model's
lower side so left and right stay mirrored. `GeometryResult.keyring` reports the opening centre and,
for articulated names, the carrying letter.

**Rationale:** The articulated builder attached the ring to the first glyph whatever the position,
so Right put it between A and L of ALEX, where the next socket and connector ran through it. A
972-build matrix (`pnpm test:geometry:keyring`) then showed openings partly filled on every other
template without any error: oval slots and ±3 mm offsets on sloped Contour, Bubble and Arch edges,
Ribbon diagonals, Capsule and Soft tag diagonals on long names (the corner fell outside the scan
band), Heart split offsets and thin or notched articulated letters (Montserrat IIII, Mo).

**Consequences:** Side, top and bottom placements that were already clear keep their position;
blocked placements now sit further out, diagonal placements can move toward the corner and Ribbon
right moves from the upper to the lower tail tip, so some shared designs render their ring
differently. Single-letter articulated names and Cyrillic in Latin-only articulated
fonts stay rejected by their existing rules. The keyring picker artwork is regenerated from the
builder whenever placement changes (`pnpm assets:keyring-previews`, `--check` to verify).

## Hosted CI runs selected gates in parallel jobs

**Status:** active

**Decision:** The routine workflow classifies changes once and runs the selected gates in parallel
`static`, `unit` and `browser` jobs; `quality` aggregates them and stays the required status.
Related unit tests use 4 Vitest workers and browser gates 2 Playwright workers. Changed specs run on
`desktop` and `mobile`, plus `mobile-2x` when the spec depends on the pixel ratio. Merge pushes to
`main` skip the `browser` job. Chromium is installed without apt unless a library is missing.

**Rationale:** Measured on GitHub runners: a UI pull request touching `model/types.ts` spent 7.4 min
in related unit tests (883 of 908 test-seconds were geometry builder suites, correctly selected but
run on one worker) and 9.2 min in changed specs on three profiles and one worker; a merge to `main`
reran the same selection for 26 min. Public-repository runners have 4 vCPUs and are not billed.
`playwright install --with-deps` once stalled 8 min 46 s downloading optional fonts from an apt
mirror while every system library was already present; the UI font covers EN/RU/UK and no spec
compares screenshots.

**Consequences:** Geometry builder suites still run whenever static analysis relates them.
`mobile-2x` coverage for a changed spec without pixel-ratio logic comes from the critical journey
and local runs only. The merge-push skip trusts the pull request's checks; without branch
protection that requires up-to-date branches, `static`, `unit` and the production journey are the
post-merge checks.

## Customizer UX pass: colors survive template switches, history covers every edit

**Status:** active

**Decision:** Switching template or style never changes colors a person chose: once either slot
is chosen, a slot that still follows the old template default is pinned when the new default
differs (`keepAppearanceAcrossTemplates`). Untouched defaults follow each template's palette
(amended 2026-11-06): Articulated name shows almost only its caps from above, so the keychain's
cream text color made light letters on a light stage; its own palette keeps red and cream with the
red on the letter faces, as its template card shows. Every accepted edit enters a 50-step undo/redo history
(Randomize, recovery fixes, sidebar color edits, Reset all and Quick setup colors included;
color-picker drags within 0.8 s are one step); Undo and Redo stay in the header and respond to
Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y outside text fields. History follows the order of
actions: an Undo or Redo whose step depends on a pending geometry check (a pending undo or redo,
the pending edit itself, or a redo step that edit discards) waits for that check and then runs in
order; undoing a newer color change runs at once; a rejection, failure or new edit drops waiting
steps. The Print facts card is removed: one
readout line beside the preview shows size and thickness, part count only above one, and the fit
check only with a chosen maximum; a notice under the preview appears only for warnings or errors.
Rebuilds keep the last model sharp (no full-viewer blur); Export stays clickable and a click
during a check opens the dialog once the latest edit is accepted. Phones get a one-row header and
a sticky, shorter preview. Model swaps crossfade (220 ms) and camera presets tween (320 ms); both
are instant under reduced motion. Fitted-camera distance is unchanged.

**Rationale:** Owner-approved UX review on 2026-11-05: colors changed silently on template
switches, mobile edits were invisible below the preview, and the facts card mostly showed values
that were not actionable.

**Consequences:** E2E camera presets use `selectCameraView` (Home button plus the Views menu) and
wait for `canvas[data-motion="idle"]`. Simple choices are segmented rows; sidebar colors are
44 px chips that keep the 4 px inset. The boot frame renders the same section links as the live
sidebar so the hand-off has no layout jump. The phone header stays one row with Undo and Redo
enabled in EN/RU/UK: the brand mark hides at 385 px and below, and header targets shrink to
32 px at 340 px and below.

## Local validation scales to the machine; heavy suites are sharded by file

**Status:** active

**Decision:** Local validation defaults to `min(4, cores)` gate concurrency on small machines and to
all but two cores (at most 8) on larger ones. The full Unit gate uses the whole budget as Vitest workers;
`unit:fast` and the full Browser gate use half (never fewer than two). The geometry matrix accepts up to 8 workers and schedules contiguous
case packages longest-first from recorded per-case durations. Long-running Vitest suites are split
into several files (for example `keychain-builder.styles-fonts.<style>.test.ts`) instead of
growing one file; `test:fast` excludes the whole `keychain-builder.*.test.ts` set by glob. Only the
Husky wrapper makes `validate:push` read stdin (`VALIDATION_PRE_PUSH_STDIN=1`).

**Rationale:** Measured on a 10-core M1 Pro: one file (`keychain-builder.styles-fonts.test.ts`,
321 s) was the whole critical path of the full Unit gate and `geometry-contract.test.ts` (77 s) of
`unit:fast`, because Vitest parallelises across files only. The matrix is ~87 CPU-minutes and
scaled linearly (44 min at 2 workers, 22 min at 4) but was capped at 5 workers. A manual
`pnpm validate:push` from a non-TTY, never-closing stdin (agent shells) hung before any gate.

**Consequences:** Sharding and scheduling change only placement and order: test names and the
4,267-case matrix are unchanged and must stay so. The manual full CI profile pins
`VALIDATION_CONCURRENCY=1` and `MATRIX_CONCURRENCY=1`; routine CI parallelism is described in
"Hosted CI runs selected gates in parallel jobs".
Slowdown warnings compare against local history and are informational, not a gate.

## Frontend analytics releases identify the exact source commit

**Status:** active

**Decision:** Derive each frontend bundle's `app_release` as `<package.json version>+<full 40-character source SHA>`. Use `<package.json version>+local` only for development builds without Git metadata. Do not set a per-push release variable or bump the package version for routine code updates; change the package version only for an intentional named software release.

**Rationale:** A source commit uniquely identifies the deployed frontend revision without requiring a manual release step on every push. Rebuilding the same commit produces the same label, while a later commit produces a different label.

**Consequences:** Preserve full-SHA validation, bundle-bound `app_version` and `app_release` stamping on app and SDK events, and tests/docs for the attribution path. Production build workflows need to provide the source SHA through the supported CI metadata or Git metadata.

## Preview geometry and export geometry have separate cache entries

**Status:** active

**Decision:** Preview and candidate validation build the same validated model without tessellating
the additional export mesh. Export requests build/cache exportable geometry on demand. Preview and
exportable entries share one bounded memory budget but use distinct quality keys.

**Rationale:** Initial preview previously built export data that the renderer did not consume.
The standalone same-host benchmark showed negligible warm wall-time benefit; this is removal of
unneeded export work, not evidence of a large startup speedup. Local timings now separate WASM
wait, worker build/response preparation, client cloning/round trip, Viewer import/init, and draw.

**Consequences:** Preview entries must never satisfy export requests. Preserve validation,
connectivity, font identities, final export quality, and client cache buffer isolation. Keep client
cloning because returned typed arrays remain mutable; remove it only with an explicit ownership
contract and supporting measurements. Do not change raster quality without a browser trace.

## Design choices stay contextual and range controls share one section

**Status:** active

**Decision:** Non-range choices that depend on a template or style appear directly after that
selection. Every range input appears exactly once inside one Adjustments section, grouped under
Typography, Shape, Template details, Style details, or Print. Empty subcategories are omitted.

**Evidence:** Current user direction; the Template and Style card rails in `ControlsPanel.tsx`; the
currently separated Magnet, parameter-group, Geometry Finish, and Heart-center sections;
`docs/design-concepts.md` and `AGENTS.md` progressive Workshop guidance.

**Rationale:** Proximity communicates ownership for discrete choices, while a single range section
makes slider discovery consistent without separating the controls by rigid top-level panels.

**Consequences:** Heart range controls appear under Style details in Adjustments; its center treatment
stays beside the Heart choice. Template range controls use Template details in Adjustments, while
discrete hardware choices stay beside Template. Reuse shared cards, field stacks, reset actions,
disclosures, and statuses instead of creating a local layout for each template or style.

## Preview performance changes follow phase measurements

**Status:** active

**Decision:** Record candidate-to-render duration and separately measure geometry worker work, main-
thread mesh setup, and renderer draw submission before changing preview quality. Only test temporary
pixel-ratio or shadow reductions when profiling shows rasterization is a meaningful share of the
delay; restore final preview quality after the interaction settles.

**Rationale:** Lowering pixel ratio can reduce GPU work but cannot shorten worker geometry or mesh
setup time, and may make the editor feel blurry during normal use. Phase timings identify the actual
cost first.

**Consequences:** Keep diagnostics local and opt-in through the performance suite. Compare desktop,
mobile emulation, and real lower-end devices before choosing adaptive quality thresholds. Geometry
validation and exported mesh quality are not reduced.

## Catalog metadata owns Customizer control applicability and placement

**Status:** active

**Decision:** Canonical template, style, and parameter metadata must describe supported choices,
dependencies, range behavior, presentation owner, and order. Rendering, reset, randomization,
normalization, sharing/tool schemas, and coverage derive from that contract rather than maintaining
independent component-local lists.

**Evidence:** `TEMPLATE_CATALOG`, `STYLE_CATALOG`, and `PARAMETER_REGISTRY` already drive substantial
parts of availability, ranges, normalization, and randomization. `PARAMETER_GROUPS` currently adds a
separate presentation classification that can strand style-specific controls in generic Shape UI.

**Rationale:** One registry-backed contract makes new templates/styles reviewable and prevents a
control from being missing, duplicated, shown out of context, or omitted from validation.

**Consequences:** Adding a template, style, or exposed parameter requires metadata and a coverage test
for its owning Template details, Style details, Refine, or Print group. Components may branch for
genuinely distinct behavior, but not duplicate applicability as presentation convenience.

## Parameters and generated geometry are accepted atomically

**Status:** active

**Decision:** Treat edits as candidates. Accept parameters, resolved fonts, geometry, persistence,
share/export state, and relevant history together only after the matching geometry result validates.
If validation or generation fails, discard the candidate and retain the complete last-valid design.
Rapid interactions use latest-candidate-wins semantics.

**Evidence:** The 2026-09-10 deployed Heart diagnostic reproduced a state where chamfered edge values
remained selected after “Not manifold” while the previous valid mesh stayed visible.
`useCustomizerParams.update` currently writes before `useGeometryGeneration` succeeds; the generation
hook retains its prior result on rejection and marks the new input non-current.

**Rationale:** Controls, preview, persistence, sharing, and export must describe the same object. A
stale mesh with newer visible settings misleads users about both the design and the exported result.

**Consequences:** Keep a last-valid checkpoint and candidate signature that includes parameters and
font identity. Superseded completion cannot commit or warn. Randomization, reset, restored/shared
documents, template/style selection, and native WebMCP application use the same acceptance boundary.
Do not persist or export a rejected candidate.

## Geometry failures revert safely and explain one recovery

**Status:** active

**Decision:** A rejected candidate restores the previous accepted value and preview. Show a concise,
localized warning at the responsible control group naming what could not be applied, what was kept,
and exactly one useful recovery action. Keep technical details behind a native disclosure when they
help diagnosis.

**Evidence:** Current user selection of safe reversion; `docs/design-concepts.md` requires plain
blocked/attention states with one recovery; the prior generic “Fix this” action was removed because it
could not repair the underlying geometry/font issue.

**Rationale:** Silent auto-adjustment changes user intent, while keeping a blocked value visible
preserves the control/preview mismatch. Safe reversion makes the actual design unambiguous.

**Consequences:** Known input ranges may be normalized before generation, but failures never trigger
an undisclosed nearby value or style. Warnings use an accessible non-duplicating live region, do not
move focus, and do not flood toasts during range input. Raw worker or topology messages are not the
only user-facing explanation.

## Every visible option must communicate and produce an effect

**Status:** active

**Decision:** Show a control only when it applies and can change geometry or an explicitly labelled
property. Make the effect clear through the selected treatment, live preview, measurement/status
change, or concise adjacent description. Do not compensate for an imperceptible or ineffective
control with permanent explanatory prose.

**Evidence:** Current user direction; the Heart diagnostic showed that selecting an already-current
default can be mistaken for a failed update; Workshop guidance prioritizes visible state and direct
actions over explanation.

**Rationale:** Users should understand what an option will do before or as they operate it, and should
never have to guess whether the application registered their action.

**Consequences:** Registry-driven tests cover representative safe values for every exposed geometric
control and high-risk cross-feature combinations. Controls with no meaningful effect in a context are
fixed or hidden. Motion is limited to selection, update, disclosure, progress, success, and rejection,
with reduced-motion behavior preserved.

## Public MIT client and private hosted-service boundary

**Status:** active

**Decision:** The public MIT repository keeps the Customizer, browser geometry/preview, free single
STL/3MF exports, local batch generation, subscription UI, and public versioned `/api/v1` DTOs and
mock fixtures. Accounts, subscriptions, synchronized reusable presets, billing, email, and service
operations belong to a separate private hosted service. CSV names, generated geometry, and batch ZIPs
remain local to the browser workflow.

**Evidence:** `README.md`, the current hosted API client contract/tests, and the public/private split
in the current worktree. The removed server/deployment files are not evidence of a running service.

**Rationale:** Preserve an auditable open-source local-first product while allowing the commercial
subscription service to be developed and operated privately without exposing provider or billing
internals in the public repository.

**Consequences:** Do not move ordinary generation/export server-side, persist customer text in hosted
presets, or reintroduce server/deployment/provider internals here. Private repository creation or
transfer and service implementation require explicit authorization and an external repository; no
deployment or operational readiness is implied.

## Vite/React SPA remains the SEO delivery model

**Status:** active

**Decision:** Keep Vite/React with one static application entry and Netlify SPA fallback; render SEO
catalog and metadata in the client application.

**Evidence:** `docs/adr/0001-vite-react-seo.md`, `netlify.toml`, and `docs/seo.md`.

**Rationale:** Geometry, WebGL, workers, and browser font handling already share a browser-first
runtime; server rendering would add a separate build/runtime contract.

**Consequences:** Revisit only if server-rendered or build-time SEO becomes a hard requirement.

## Version 11 design documents are the share contract

**Status:** active

**Decision:** Persist/share structured v11 design documents, including an optional size envelope,
independent base and text edge profiles, and keyring opening preset/shape, attachment position, and
slot length. The position field supports four cardinal edges plus upper-left and upper-right
diagonals. Continue reading v6-v10 links; v5 links remain unsupported. Unbundled fonts are replaced
with a bundled fallback in shared links.

**Evidence:** `docs/geometry-roadmap.md`, `src/domain/keychain/design-document.ts`, and its tests.

**Rationale:** The schema separates semantic design sections while preventing font bytes from being
embedded in URLs.

**Consequences:** Preserve strict decoding and explicit fallback behavior. A v6 text edge amount
inherits its old backing profile when decoded. The removed legacy `separateParts` payload field is
ignored for compatible v6 decoding; it is not a current design parameter.

## Geometry validation is authoritative software evidence, not physical proof

**Status:** active

**Decision:** Geometry results drive preview and export blocking. Unexpected disconnected geometry
blocks export; intentional Heart Split assemblies require explicit acknowledgement. Automated matrix
and slicer checks do not establish physical-print readiness.

**Evidence:** `docs/geometry-roadmap.md`, `docs/print-validation.md`, export preflight code, and
geometry contract tests.

**Rationale:** Printable status alone is insufficient without topology/connectivity evidence, and
printer/material behavior remains external.

**Consequences:** Preserve the baseline print profile, warnings, topology checks, and separate
physical validation table. Do not silently bypass severity errors.

## Seller-pilot physical checks are limited to the recipes the pilot uses

**Status:** active

**Decision:** If a seller pilot is later authorized through the separate private service, physically
validate only the exact Name-keychain preset recipe or recipes that seller will use. Do not require
the complete template/style matrix for that narrow pilot, and do not use pilot evidence to claim that
untested recipes are physically validated. The full baseline matrix remains the evidence gate for
broader physical-readiness claims.

**Evidence:** Explicit user selection on 2026-09-26 to validate only the exact pilot recipes before
inviting the first sellers, while keeping print claims provisional for other combinations.

**Rationale:** Recipe-specific prints provide relevant evidence for the seller batch workflow without
making a narrow, separately authorized pilot depend on unrelated templates.

**Consequences:** Record printer/profile, dimensions, observations, slicer warnings, and evidence for
each recipe actually used. Keep software geometry validation and physical print evidence distinct.

## Published SEO scope and locale rules are finite

**Status:** active

**Decision:** The typed SEO catalog controls sitemap, canonical URLs, hreflang, and structured data.
Localized paths override conflicting query locale; privacy remains canonical at `/privacy`; only the
customizer emits `WebApplication` JSON-LD. Bare/invalid customizer routes and profile remain noindex.

**Evidence:** `docs/seo.md`, `docs/architecture.md`, and `src/features/seo` route/catalog tests.

**Rationale:** Prevent duplicate or doorway-style indexed pages while preserving useful localized
entry points.

**Consequences:** Change catalog, sitemap, metadata, locale tests, and focused route coverage together.

## Telemetry is consent-gated and data-minimized

**Status:** active

**Decision:** PostHog integrations remain disabled until visitor consent. Events contain only the
documented coarse allowlisted metadata; names, raw queries, geometry, and files are excluded.

The approved Customizer feedback signals extend this allowlist with fixed setup-step IDs and stable
catalog option IDs. Campaign/referrer persistence is disabled; SDK URLs are reduced to origin and
route before sending; campaign/search attribution, referrer, raw user-agent, viewport-size, and
client-side GeoIP properties are omitted from event and person-property containers. Activity is
pseudonymous, not fully anonymous.

**Evidence:** `docs/analytics.md`, `README.md`, and telemetry implementation.

**Rationale:** The editor's local-first privacy promise.

**Consequences:** Do not enable autocapture, session replay, cookies, or expand event payloads without
an explicit privacy decision and matching implementation/tests.
Feedback that a visitor explicitly sends is covered by "Explicit feedback is sent on submit"
(2026-11-06).

## WebMCP is a native, narrowly scoped enhancement

**Status:** active

**Decision:** Register only `get-keychain-state` and `customize-keychain` on the customizer through
native `document.modelContext`; ordinary browsers keep the normal workflow with no polyfill.

**Evidence:** `docs/webmcp.md`, `public/_headers`, and WebMCP hook/tests.

**Rationale:** Tools operate only on the open browser session and must not replace human control.

**Consequences:** Keep exports user-confirmed and browser-local; do not add credential, randomize,
share, or export tools without a new safety decision.

## FSD boundaries and the three visual systems govern frontend changes

**Status:** active

**Decision:** Keep FSD dependencies downward, route pages composition-only, one component per file,
and direct imports instead of new convenience barrels. Use Maker Editorial for landing, Reference for
public content, and Workshop for customizer/export/seller flows.

**Evidence:** `docs/architecture.md`, `docs/design-concepts.md`, `AGENTS.md`, and ESLint rules.

**Rationale:** Preserve explicit dependencies and coherent visual density across distinct product areas.

**Consequences:** Preserve native control semantics, visible focus, reduced-motion behavior, shared
status/field-stack/disclosure/icon conventions, and desktop/mobile/mobile-2x UI review.

## Quick setup is optional and size envelopes remain active

**Status:** active

**Decision:** Landing-page Start designing opens a dismissible setup dialog with no selected size.
The selected width and height are a maximum, not exact stretched dimensions. Keep that envelope in
the current document and enforce it during subsequent geometry generation. Favorite font categories are
browser preferences; Show all and explicit search/category filters reveal the remaining choices.
Direct and restored designs do not automatically open setup.

**Evidence:** `useQuickSetup.ts`, `QuickSetupDialog.tsx`, geometry contracts, and quick-setup E2E.

**Consequences:** Preserve accepted geometry on an impossible size; keep the draft open for recovery.
Base and text profiles are independent. Text finishing affects its front edge only. Per-profile limits
travel through the worker result contract. Actual dimensions and selected maximum dimensions are
shown separately from one accepted-state metrics selector; maximum dimensions never imply stretching.

## 3MF keeps material volumes together and leaves filament assignment to the slicer

**Status:** active

**Decision:** Separate-colors export keeps one model and mesh with selected color regions. Encode
the regions with a 3MF Materials Extension color group for Bambu Studio, retain Core base materials,
and add Prusa-compatible named volume ranges carrying each selected hex color. Do not export the
backing and relief as independent build objects or inject a printer configuration to force display
colors.

**Evidence:** PrusaSlicer 2.9.6 CLI drops Core display colors, imports independent component objects
as separate models, and preserves the named-volume form as one aligned model. The 30-file slicer
gate and ten separate-color roundtrips preserve volume bounds and color references with no repairs.
The supplied Bambu Studio file had only Core materials and Prusa volume metadata; Bambu's importer
reads Materials Extension color groups to map triangle colors, so separate-color output now carries
that group too.

**Consequences:** The file carries the selected palette, while users assign matching filaments in
their slicer. Printer profiles stay outside the export; Bambu Studio may still show its generic
geometry-only configuration notice. Export details show the hex references. Geometry/slicer
validation is not physical-print or automatic filament-mapping proof.

## Private hosted operations are a separate blocked workstream

**Status:** blocked pending authorization and an external repository

**Decision:** Do not implement, deploy, or operate the hosted subscription service from this public
checkout. When explicitly authorized in a supplied private repository, its service, provider stack,
security, billing, email, migration, backup/restore, health, and hosted-E2E contracts must be defined
and validated there.

**Evidence:** Current worktree removes the former server/deployment/provider internals while retaining
the public client contract and mocks. No private repository or target environment was supplied.

**Rationale:** Provider and operational details are private product infrastructure, not part of the
MIT client source; recording an old optional-pilot deployment design would falsely imply readiness.

**Consequences:** Treat hosted service creation, transfer, implementation, deployment, and production
validation as blocked. Never claim live readiness from public repository assets alone.

## Focused optional setup with conditional keyring steps

**Decision:** Setup uses Name & size → Keyring position → Opening → Font styles → Colors → Review for supported templates, with one step visible at a time. Template selection stays in the editor; opening setup never changes the template.

**Rationale:** User feedback explicitly rejects an overloaded single modal and requests icon-led,
short, adaptive controls based on the supplied reference. Separate keyring position and opening
steps keep each decision focused.

**Constraints:** No size preselected for fresh models; retain existing maximum-envelope semantics.
Remember accepted font preferences. Back/review Edit preserve drafts; closing discards unsubmitted
changes. Colors and preferences commit only after geometry acceptance. Preserve Workshop typography,
native semantics, reduced motion, and mobile text fitting. Shared/restored designs bypass auto setup.

## Independent base/front-text finishing and compact natural-width choices

**Decision:** Restore base finishing independently of text, superseding the 2026-10-05 removal.
Use native contour bands for chamfers/rounding, retain independent base top/bottom and text front
amount controls, and expose verified consecutive 0.2 mm amounts only. Preserve real
contours/counters and the lower text surface. Zero-volume Boolean residue is numerical cleanup,
not permission to remove disconnected letters. Enclosed negative-volume void shells do not count
as separate printable bodies.

Sharp edits verify only the initial 0.2 mm choices; selecting a finish expands its safe range.
Cache only limit values, never native geometry objects. For tilted nameplates, remove detached
positive slivers with estimated thickness below 0.001 mm after warping. Preserve cavities by
rebuilding retained positive bodies and explicitly subtracting reversed negative-shell cutters;
the native union/compose operation alone fills enclosed cavities.

**Compatibility:** v9 restores backing parameters. v6/v7 retain base settings and infer the v6 text
profile from its former shared profile. v8 has a sharp base by default. No backing-removal notice
is shown for restored legacy finishes.

**UI:** Setup width is at most 600 px. Font chips fit their content and use real bundled Aa specimens;
actions use Lucide icons. Only keyboard focus adds a ring. Sidebar colors use two balanced native
fields with a 4 px color inset, individual resets, and no reset-all action. Quick setup uses a
labelled ListChecks icon beside Randomize, left of a centred Export (superseded 2026-11-05, see
"Customizer UX pass"). Rendered preview aspect must match displayed canvas
aspect; capture readiness includes a completed resize render.

**Evidence:** User decisions on 2026-10-05, ALEX/Nunito 0.6/0.8 mm reproduction, native generation
regressions, and focused responsive wizard/color captures.

## Inspection magnification and shared Workshop roles

- Use lens magnification (0.25–4×, initial 1×) independently of the safe full-model camera fit.
  Close-up cropping is intentional; do not weaken fitted-camera geometry safety to enable it.
  Retain angle, magnification, and relative pan through refinements; template changes and Fit clear
  zoom/pan, and only Home also restores the home angle. Pan is bounded and available above 1×.
- Keep Backing strength and Text strength nested in their own finish groups with their feedback.
  Preserve independent verified amounts, Custom state, Pro precision, and Sharp behavior.
- Centralize visual roles under `src/shared/constants/design/` in separate palette, typography,
  dimensions, and Workshop composition files; retain the legacy token entry/aliases. Migrate
  Workshop first, preserving public visual systems and user-selected model/material colors as data.

## Font pages and default preset recognition

The Simple font picker now uses fixed pages of three compatible bundled fonts, with scroll snap,
visible current-page dots, and per-target browsing. This supersedes the random suggestion/history
presentation. Browsing never changes fonts; the full chooser remains available. Keep Style directly
below Templates in a connected group, ahead of hardware. Match Balanced backing thickness to the
existing 2.4 mm domain default and Balanced Heart to 22/1.6 mm rather than changing domain defaults
or selecting an approximate preset. Preserve genuinely unmatched values as Custom. Shared motion
roles live beside the other design constants; respond to interaction and respect reduced motion.
The setup remains focused, transactional, and without a preselected size for new designs.

## Scrollport interaction gutters

Scrollable Workshop cards reserve shared block/inline gutters inside the clipping boundary for
hover lift, shadows, selection borders, and external focus rings. Font pages own border-box padding
so their full-viewport stride remains unchanged; template/style rails share the gutter tokens.
Do not substitute z-index or removed/inset focus feedback for adequate layout space. Horizontal
scrolling also affects vertical overflow computation, so audit every clipping ancestor.

## Simple fonts extend on explicit request

Use a matching Plus card after the final font to append batches of nine compatible online fonts, grouped into
three-card pages, without reordering earlier pages or changing the selected font. Reuse the existing
Google Fonts provider/cache, font metadata registry, shared preview-face loader, and transactional
selection path. Do not auto-fetch catalog metadata on scroll or persist discovery preferences.
Deduplicate normalized family names and respect articulated/script restrictions. Retain a search
escape route when loading fails or suggestions end, and keep the active page dot visible without
unbounded dot rows. Share preview loading with the full font browser; preload only current/next
Simple pages and guard superseded selection/target changes. Bundled fonts are exempt: their
specimens come from the generated outline sprite (2026-11-07 entry) and load no font file.

## Font discovery is an inline card

The More fonts action shares the font-card visual role and occupies the next free slot on the last
page; add a page only if the font page is full. It is a native button rather than a radio option.
Loading/retry retain its size and Plus icon; exhausted/restricted states use a Search card. Move the
action to the new end after appending without repacking old partial pages. Page counts/dots derive
from displayed pages, while preview loading and append focus retain the underlying font pages.

## 2026-10-16 — Allowlisted, consent-gated portfolio referrals

- Recognize only `utm_source=portfolio&utm_medium=referral&utm_campaign=projects`, with one value
  per parameter. Emit only the fixed event context `acquisition_source: portfolio`; never raw
  campaign values, referrers, click IDs, or person attribution properties.
- Retain the recognized marker in memory before consent to survive SPA navigation. Store only
  the fixed marker in tab session storage after acceptance, reuse it across refreshes in that tab,
  and clear it plus queued events on decline. Storage failures fall back to memory.
- Keep SDK campaign/referrer collection disabled and retain URL/query and attribution scrubbing.
  This is a narrow exception for the explicitly authorized portfolio source, rather than enabling
  broad acquisition tracking. Measure consented production activation/export events with existing
  pseudonymous IDs; no identity linking, new dashboard, or production mutation is included.

## 2026-10-16 — Category-led starts and offline font discovery

The starting carousel contains all compatible fonts in saved setup categories; absent categories use
Calligraphic/Handwritten/Rounded. A selected provider variant occupies its existing family card.
The Plus card prechecks configured/online/provider state, falls back to random unseen, unselected
bundled/available-local fonts with category variety, and disappears when both sources are exhausted.
This supersedes the previous Retry/Search terminal-card behavior; Find a specific font remains below.
Both carousel scrollbars stay hidden, and the centered page-dot strip is capped at 16rem while
retaining 44px touch targets. Preserve old pages and focus recovery when removing the action.

## Font page dots wrap instead of scrolling

Keep the compact centered dot list capped at 16rem and wrap all page buttons into visible rows.
Do not clip or horizontally scroll page buttons, and remove automatic dot-strip scrolling. Retain
44px touch targets and focus-visible feedback. Font cards still swipe with their scrollbar hidden.
This supersedes the earlier horizontally scrolling dot-strip choice.

## 2026-10-17 — Input-aware, bounded Workshop motion

Keyboard/assistive/programmatic navigation and setup steps are immediate. Pointer navigation may
scroll smoothly; shared icon hover movement requires hover support and a fine pointer on all routes.
Pointer setup entry is 200ms without overshoot. Font discovery reveals only up to three visible new
cards, once per batch, within 260ms; dots/offscreen cards appear immediately. This supersedes the
batch-wide sequential discovery reveal and smooth append navigation. Reduced motion is observed
live by the camera controls as well as CSS, preserving the current pose when inertia is disabled.
No geometry, persistence, font fetching, or export contract changes are part of this decision.

## 2026-10-18 — Shared anchored actions without preview reflow

Photo resolution choices overlay the existing camera button rather than expanding below the viewer.
Photo, Surface and Share share a non-modal, portaled Floating UI primitive with viewport collision
handling and focus/dismissal behavior. Feature hooks retain async capture and sharing state; shared
UI accepts typed button/link actions without knowing domain operations. This supersedes the Photo
resolution-card section below the preview. Share sends accepted editable-design links only through
copy/native sharing or explicit social composer links; no social SDK/backend/upload is added.

## 2026-10-18 — Popup motion, brand artwork and JPG

Pointer popup presence uses existing 200ms/160ms CSS motion roles with a reversible 0.95 scale and
opacity transition anchored to the trigger. Keyboard/reduced-motion changes stay immediate; exit
content is inert and excluded from accessibility before visual removal. Animate a separate inner
surface so Floating UI positioning never competes for transform. Social artwork and colors come
from tree-shaken Simple Icons assets. Photo adds a mounted-only PNG/JPG radio choice, keeping PNG as
the backward-compatible capture default; JPG uses image/jpeg, .jpg filenames and quality 0.92.

## 2026-10-18 — Input-aware candidate scheduling and bounded validation

Discrete geometry changes dispatch immediately; text uses 100 ms trailing debounce; continuous
controls dispatch on the leading edge and coalesce within 32 ms windows. Only interactive candidate
validation is latest-only: one active build and one queued latest request. Supersession settles caller
promises while retaining the active worker slot/watchdog until the real response; synchronous WASM
is never interrupted by terminating its worker during dragging. Independent validation and export
retain their existing contracts. Acceptance, geometry-limit reconciliation and rejection rollback
remain transactional. Local cache/queue and input-to-render timings are diagnostic only and do not
add telemetry payloads. Cache-hit timings describe current lookup/clone work, not historical builds.

Draw submission and ready-state DOM commit are separate local diagnostic phases. Performance
acceptance uses input-to-ready commit, with DOM-observed event-to-generation comparisons as a
cross-check. Neither timestamp claims GPU completion or physical display presentation. Headless
Chromium traces can include substantial software-GPU/compositor cost outside geometry generation;
do not label draw-submission latency as the full visible-update latency.

## Validated, explicit Customizer recovery — 2026-10-19

The central recovery catalog owns stable error codes and localized explanations/steps. A rejected
candidate retains its requested parameters and fonts separately from the accepted design. Opening
recovery checks at most two proposals in a separate disposable worker; only verified printable
results can be applied, guarded against stale parameters and font identities. Applying is explicit
and undoable. Font/edge conflicts first preserve the requested font with a smaller or sharp edge.

Use an anchored popover in the editor and inline recovery inside existing dialogs. Operational
failures use the same notice with feature-owned retry/manual actions. Unknown diagnostics remain
behind a disclosure. This supersedes the earlier single manual-review action decision for rejected
candidates; accepted-preview preservation, privacy and persistence contracts remain unchanged.

## Preview lifecycle acknowledgement and bounded recovery — 2026-10-19

Readiness is tied to renderer session plus installed geometry generation, and is acknowledged only
after a valid camera and successful draw submission. It is not evidence of GPU completion. Rejected,
lost-context or disposed sessions cannot acknowledge newer state. Geometry printability remains
independent; Photo requires the current preview to be ready.

Inspection snapshots retain validated orientation, zoom and pan only after model installation.
They refit to current bounds instead of restoring unchecked absolute camera coordinates. This
prevents development Strict Mode effect replay from saving/restoring the unfitted origin camera.
An invalid camera falls back to Home; renderer/context failure gets one automatic restart per
mounted editor session, followed by explicit retry/reload. Manual retry resets the allowance;
successful frames do not. Existing accepted geometry, colors and preview surface remain intact.

## 2026-10-20 — Explicit recovery after exhausted geometry worker replacement

Keep the existing bounded automatic worker replacement; never automatically replay failed exports or
increase the watchdog. A new user export or explicit preview/export Retry can re-arm an exhausted
client once. Pending work settles on failure, worker generations stay isolated and accepted geometry
is preserved. A failed manual restart remains an error with another explicit recovery action.
Export attempts retain one ID and one terminal outcome; fixed stage/type diagnostics distinguish
worker lifecycle, initialization, generation, serialization and download without model content.
Production builds require a validated source SHA, with explicit CI metadata and Netlify/Git fallback.

## 2026-10-20 — Mandatory critical journey before every shipping change

Every push of a checked-out revision, routine CI selection (including docs/test-only or no changed
paths), and standard/full validation must run an unskippable, uncached Browser journey against its
verified local build. Remote branch deletion has no shipped revision and retains its existing skip.
The journey covers landing entry, all setup steps, editor changes, a visible model, decoded STL and
both distinct 3MF modes, subsequent editing/export, and explicit worker recovery on desktop/mobile/
mobile-2x. Existing affected checks and exhaustive full regression remain available.
Production build must test the actual Netlify-built artifact before upload; deploy depends on that
job and consumes only its checked artifact. External preview URLs cannot substitute for this check.
Missing validation tools or failed/skipped journey means failure, never a successful checkpoint.
Do not bypass the required push checks with --no-verify or HUSKY=0. All six critical cases must
finish as ordinary passes; focused, skipped, expected-failure or partial suites fail. Concurrent
Browser gates isolate traces/downloads per run/gate rather than sharing Playwright output cleanup.
This supersedes documentation-only formatting and geometry-only CI Browser exclusions.

## 2026-10-24 — Bounded interactive geometry recovery and structured outcomes

Keep one automatic worker replacement per failure episode. A successful warmup/ready message does not
reset that budget; only a normal geometry, validation, or export response does. After exhaustion, an
explicit Retry or the next user candidate edit may replace the worker once. Never replay obsolete
requests, recreate a disposed client, or let slider/text activity create an automatic restart loop.
Worker generations keep monotonic request IDs, ignore stale replies, and settle their pending work on
failure or disposal.

Candidate rejection preserves accepted params, font identities, geometry and export eligibility.
Measured geometry-dependent parameter corrections are shown as explicit, fully revalidated recovery
options. Export eligibility compares the retained result key with accepted params and fonts, so a
transient preview worker error does not discard an exportable accepted design.

New geometry analytics use paired `geometry_attempt_started` / `geometry_attempt_finished` events.
Expected rejection, technical error, supersession and cancellation remain distinct. Structured failure
codes/stages and fixed control IDs replace message-regex classification; no text, exact settings, font
bytes, geometry or file contents are collected. Historical `geometry_error` data remains unchanged
and must not be interpreted as proof of an engine crash.

## 2026-11-03 — Preview stage timings in consent-gated telemetry

The owner approved adding these keys to `geometry_ready`: `wasm_wait_ms`, `worker_boot_ms`, `worker_compute_ms`, `client_round_trip_ms`, `client_queue_ms`, `cache_hit`, and `cold_start`. The owner also approved the new event `preview_rendered` with `geometry_generation_id`, `template`, `mesh_setup_ms`, `draw_submit_ms`, `initialization_ms`, and `cold_start`. These are coarse numeric timings and booleans with no user content, device identifiers, or viewport data. Like every event, they are sent only after consent. Their purpose is diagnosing mobile cold-start latency from field data.

This supersedes the 2026-10-18 statement that cache/queue timings add no telemetry payloads, only for these keys. Edit-time input-to-render timings remain local diagnostics. Evidence: the sanitizer scope and range tests in `src/infrastructure/telemetry/telemetry-events.test.ts`, and `docs/analytics.md`. The owner also approved `worker_replacements` (an integer from 0 to 20, the cumulative count of replacement geometry workers in the editor session) on `geometry_attempt_finished` and `geometry_error` as part of this same diagnostic set. The owner also approved `preview_quality` (`high`, `medium`, or `low`) on `geometry_ready` and `preview_rendered`, recording the adaptive preview tier in effect (see 2026-11-04).

## 2026-11-03 — Bounded automatic worker respawn with current-design re-request

The owner approved two automatic worker replacements and one current-design re-request per automatic replacement. A preview worker failure (`geometry-worker-boot-timeout`, `geometry-worker-failed` or `geometry-request-timeout`) starts at most two automatic replacements within a rolling 60 s window, and no successful response resets that window; old replacements simply age out. The first replacement starts immediately; the second waits 1000 ms. A worker is considered booted only when it reports `ready`, and it has 45 s to do so. The worker processes messages strictly serially through its own message queue, so responses arrive in request order. A per-request timer starts when the request becomes the head of the worker's in-flight FIFO (after `ready`), so a request queued behind busy work is not timed out by that wait. Exports share the same serial queue: a long export build blocks queued previews until it finishes. Builds are synchronous WASM, so the build itself already blocked; serialization only removes interleaving at short await points. A cache hit queued behind a build therefore waits for that build to finish.

The automatic re-request happens only after a boot timeout or a worker crash (`geometry-worker-boot-timeout` or `geometry-worker-failed`), and only when the failed work included the current preview: the preview request that was rejected by the failure is reissued once for the current design after the automatic replacement, recorded as `recovery_trigger = auto_replacement`. A request timeout (`geometry-request-timeout`) is not re-requested, because replaying a design that hangs would cost about three 30 s timeouts before the user sees the error; the worker is still replaced so the next edit works. A replacement whose failure did not include a pending preview needs no re-request, because the shown preview is still current. The re-request is never made when the user has edited since the failure (the edit makes its own request), and never after the budget is exhausted. Candidate validation and export failures surface as they did before; they are not re-requested automatically.

Obsolete work is never replayed: requests in flight when the failure happened are rejected with the failure error, and only requests made after it are held and dispatched on the replacement. When the budget is exhausted, explicit Retry and the next edit recovery behave as before. Explicit replacements do not consume the automatic window. This supersedes the 2026-10-24 rule of one automatic replacement per failure episode and its statement that a successful response resets the budget, and the 2026-10-20 wording that kept the single automatic replacement.

## 2026-11-03 — Geometry engine prewarm on editor intent

The owner approved prewarming the geometry engine before the editor mounts, to shorten the mobile cold start. A single pooled `GeometryClient` is created only on intent over a `/create` link (`pointerover`, `focusin`, `touchstart`) and not on a plain landing load; the 2026-11-04 entry supersedes that restriction. Prewarm is skipped when the current location is already the create route. The pool module is loaded with a dynamic import on the first intent event and deduplicated by a module-level promise, so the entry chunk does not include `GeometryClient`.

The pooled client is handed over exactly once to the editor, and the editor owns and disposes it from then on. An untaken client is disposed after a 5 minute TTL measured from its creation. Before hand-over the pool checks `isUsable()`: an unusable client (disposed, or failed with no automatic replacement left) is disposed and not handed over, and prewarming replaces it.

The `/create` prerender carries `<link rel="modulepreload">` for the geometry worker chunk without `crossorigin`, and `<link rel="preload" as="fetch" crossorigin>` for `/manifold-v1.wasm`. In Chromium, the worker constructor reuses both, and the WASM fetch made inside the worker is served from cache. `rel="preload" as="worker"` is ignored there, and `crossorigin` on the modulepreload stops the reuse. Firefox and Safari are not verified.

Cold-start telemetry keeps its keys. `cold_start` is true for the first adopted preview after each worker boot. `worker_boot_ms` is reported only when that boot completed after the editor took the client; a boot that finished while the client was pooled reports `cold_start` true without `worker_boot_ms`. Evidence: `src/features/customizer/hooks/useGeometryGeneration.test.ts` and `docs/analytics.md`.

## 2026-11-04 — Prewarm on landing idle

The owner approved prewarming the geometry engine on a landing page load as well, superseding the
2026-11-03 rule that it never runs on a plain landing load. The landing route (`/` and localized home
paths) schedules the prewarm only after window `load` (or immediately if the document is already
complete) and after LCP has been quiet for 1 s (no new `largest-contentful-paint` entry), then inside
`requestIdleCallback` with a 4 s timeout, or after 1500 ms where it is unavailable. Without
`PerformanceObserver` LCP support the LCP wait is skipped.
Leaving the landing route cancels the scheduled work before the idle callback fires. If it has already
fired, a route re-check after the chunk import resolves prevents prewarming off the landing route, so a
pending import never creates a second worker once the user reaches `/create`. The prewarm is skipped when
`navigator.connection.saveData` is true or `effectiveType` is `slow-2g`/`2g`; intent-based prewarm still
applies on those connections. The shared lazy import and dedupe are used by both paths. The 5 minute
TTL for an untaken client still applies, and hand-over and `isUsable()` checks are unchanged.

## 2026-11-04 — Adaptive preview quality

**Status:** active. Coarse-first was withdrawn the same day; see below.

**Decision (owner):** The editor preview adapts across three tiers, and a tier changes only the renderer. High is today's behaviour: DPR up to 2, antialias, a 2048 shadow map (1024 under 760 px). Medium caps DPR at 1.5 and uses a 1024 shadow map. Low uses DPR 1 and a 512 shadow map. Geometry is always built at the builders' original segment counts (64 for round offsets, 96 for ring holes), and export always uses full quality. Preview tiers never change geometry. The tier steps down one level after the last two adopted, worker-built full builds each exceed 2500 ms. It steps up one level after five consecutive adopted full builds are under 1000 ms, at most once per 30 s. The cooldown gates step-up only and is measured from the last tier change, step-downs included, so a step-up never follows a tier change within 30 s. Step-down is never delayed, so a slow phone drops tiers promptly even right after a step-up. A fast streak persists across the cooldown, so the tier steps up at the first fast build after the cooldown if the streak is at least five. The owner chose this so step-down stays prompt on slow phones. Cache hits and the first result of each worker boot are ignored and leave the streaks untouched. The measured value is the full build's `workerComputeMs`, which excludes the client round trip, WASM wait, and cold boot.

**Coarse-first withdrawn (owner decision, same day):** An earlier design showed a coarse-first provisional mesh (32 segments in medium, 16 in low) while the full build ran. The owner withdrew it and it was removed. Measured warm coarse builds cost 51–85% of a full build, and cold edge finishing was paid twice, so the accurate preview and the export unlock arrived about 1.3–2.1 s later on a slow device. The coarse worker request, its cache key, the client delivery path, the provisional overlay and the segment threading through the builders are gone. The builders use their original constant segment counts again: 64 for round offsets and 96 for ring holes.

**Renderer:** The tier is applied live to pixel ratio and shadow-map size. The shadow map is recreated only when its size changes. Antialias remains on in every tier, because it is a WebGLRenderer constructor option and changing it would require a new WebGL context and a new context-loss recovery path. Validation results now carry the worker boot id, and recovery-validated results have it stripped, so the controller can classify cold boots.

**Supersedes:** For the preview, this supersedes the 2026-10 "pixel-ratio and shadow reductions only after profiling" guidance. The owner approved adaptive reductions driven by measured worker build time. Phase measurements remain the basis for any other performance change.

**Step-1 finding:** Preview and candidate validation share one worker build and the same `preview|` cache entry. Accepted candidates adopt the validated mesh directly. Lowering the build's segments would therefore change acceptance, printability, and limit decisions, so geometry stays at the full build in every tier. Export uses a separate `exportable|` key and never reads preview entries.

**Telemetry:** `preview_quality` on `geometry_ready` and `preview_rendered` is the only new key. `preview_rendered` stays tied to the cold full generation. See the 2026-11-03 telemetry entry and `docs/analytics.md`.

**Consequences:** Geometry for export and validation, cache keys for export and validation, and acceptance are unchanged. The e2e spec `e2e/preview-quality.spec.ts` drives the tier by rewriting the worker-reported `workerComputeMs` in the page message stream. It then checks the `data-preview-quality` steps and that an STL export at the low tier matches a full-quality export of the same design.

## 2026-11-06 — Explicit feedback is sent on submit, with or without analytics consent

**Status:** active. Amends "Telemetry is consent-gated and data-minimized".

**Decision (owner):** The app asks for feedback itself instead of relying on SDK-rendered PostHog
surveys. The old "Customizer feedback" widget never rendered (`widgetType: "button"` without a
selector, which posthog-js does not display) and was ended on 2026-11-06. Two PostHog `api` surveys
replace it, rendered with Workshop components and localized in en/ru/uk:

- **App feedback** (`01a1b2d5-8181-0000-7c08-a2fd5211ce56`): optional 1–5 rating and optional
  free text. Shown inside the export dialog after a successful download (not within 60 days of an
  answer or 14 days of an unanswered ask) and from the "Send feedback" button in the controls panel,
  landing footer, SEO footer and closing call to action.
- **Print outcome** (`01a1b2d5-8db2-0000-e575-d7bb47b250bb`): Printed fine / Needed tweaks / Didn't
  work / Haven't printed yet, plus optional text. Shown once per export on a return visit 3 h–30 days
  after it, only after the consent banner is answered.

**Sending rules:** Nothing is sent until the visitor presses Send. With analytics consent the
loaded SDK captures `survey sent` (and `survey shown`/`survey dismissed`). Without consent one
anonymous `survey sent` request goes to the PostHog capture endpoint with a random distinct ID and
`$process_person_profile: false`; shown and dismissed events are not recorded. Properties are the
survey contract (`$survey_id`, `$survey_response_<question id>`, `$survey_submission_id`,
`$survey_completed`, `$survey_questions`) plus `feedback_trigger`, `locale`, `template` and `format`.
Free text is user-provided, trimmed to 1000 characters, and the form asks people to leave out
personal details. The design text and geometry are never attached. Builds without a PostHog key
send feedback by email instead. `disable_surveys: true` stops the SDK from fetching surveys.

**Support email:** Every recovery notice offers "Email support" and "Copy error report". The report
holds the failure code and message, page path, time, app build, locale, user agent, the last 10
in-memory errors and a link to the open design. The visitor's own mail app opens with it; nothing is
sent until they send it. "Send a photo" requests after export and in the print check work the same
way and include the last exported design's link. Address: `support@open-keychain.com`.

**Device state:** `open-keychain.feedback` in localStorage holds the last export (time, format,
template, design link) and when the visitor was last asked or answered. It is read only to decide
when to ask and to prefill those emails.

**Consequences:** `/privacy` describes all of this. `support_contact_opened` (reason and recovery
code only) and `start_designing` sources are the only new tracked properties and stay consent-gated.
Test builds use `VITE_POSTHOG_KEY=phc_playwright` and `VITE_POSTHOG_HOST=https://posthog.test`, which
`e2e/feedback.spec.ts` intercepts.

## 2026-11-07 — Boot stylesheets come from the build graph

**Decision:** The stylesheets linked for the pre-React boot frame are derived from the build
graph, not from a list. Production links the CSS reachable through static imports from the
Customizer page and Viewer chunks (found by facade module, imports before importers, minus the
entry CSS), collected after `vite:css-post` has folded CSS-only chunks. Development links every
stylesheet reached through static imports from `src/main.tsx`, the frame and the same two roots.
The build fails when a CSS-module class in the rendered frame is missing from the linked CSS.

**Rationale:** Since `01bdbe7` the feedback dialog shares `IconButton` with the landing and SEO
footers, which moved `IconButton.module.css` into an unnamed shared chunk. The chunk-name list
missed it, so Quick setup and Export stacked their icon over the label until the editor chunk
loaded. Any future shared chunk would fail the same way.

**Consequences:** The `customizerBootStyles` rollup input is gone; the frame's own rules live in
`customizer.css` under `.customizer-boot-frame`. Development caches the rendered frame and its
stylesheet list until a file under `src/` changes. `e2e/routes.spec.ts` checks the header buttons'
boxes and computed display, and that no stylesheet appears after hand-off.

## 2026-11-07 — Bundled font specimens are pre-drawn outlines

**Decision:** The "Aa"/"Аа" specimens of bundled fonts in the Simple font picker and the Quick
setup font step are drawn from one generated SVG sprite (`public/fonts/specimens-<hash>.svg`, via
`pnpm assets:font-specimens`) instead of text in the font's own face. The generator lays glyphs
out like the browser where opentype.js can shape them (substitutions, pair kerning) and per glyph
otherwise, at the catalog weight, instancing variable fonts on `wght`. Online and local fonts keep
loading their face for the current and next Simple pages. The full font browser still renders the
user's text in real fonts.

**Rationale:** Every carousel page renders at once, so the inline `font-family` made a cold
`/create` download all 13 default-suggestion TTFs (6.9 MB raw, 2.7 MB over Brotli) before the boot
frame finished painting, to show two letters each. The sprite is 38 KB raw (12 KB Brotli). In
Chromium at 160 px every Latin and Cyrillic specimen matches the text box to 1 px and the ink
bounds to 1 px.

**Consequences:** `/create` preloads only Nunito; landing and other pages keep Nunito and Bree
Serif. Hovering or focusing a bundled font card fetches its TTF at low priority so the geometry
worker reads it from cache on selection. `generate-font-specimens.test.ts` fails when the
committed sprite or metrics are stale.

## 2026-11-07 — The landing page boots from its real first screen

**Decision:** `/` paints the live header, hero and workflow section, rendered at build time into
`dist/index.html`, before React runs; the hand-drawn skeleton and its second copy in `core.css`
are gone. Landing, Customizer and profile frames share one registry and plugin
(`scripts/build/route-boot-plugin.ts`). The build writes `index.html` (landing), `create/index.html`
(Customizer) and `app.html` (SPA fallback without landing assets); `public/_redirects` rewrites
other paths to `app.html`. The English landing variant is inline; `?lang=ru|uk` clones a template.

**Rationale:** The skeleton drifted from the page (header 62 vs 68 px, hero 1320 vs 1180 px wide,
48 vs 130 px top padding, a 16:10 box where phones show a tall screenshot), so every cold load
jumped. The real first screen also starts the hero image download at HTML parse time instead of
after two JavaScript chunks. At 390–1920 px every measured box matches the live page within 1 px.

**Consequences:** The frame stays until React commits; on the landing page `data-boot-handoff`
holds it at most 150 ms more while the live hero image decodes, and `data-app-ready` still marks
the commit. The frame's ids and label targets are stripped so anchors such as `#faq` resolve to
the live page. While the landing frame shows, the page is 1 px taller than the viewport, so
classic scrollbars take the same width they take on the live page. The Customizer resolver now
picks the first supported entry of `navigator.languages`, as i18next does.

## 2026-11-07 — Each document preloads what its first screen needs

**Decision:** The build adds, per document, `modulepreload` for the route's chunk graph
(LandingPage on `/`; CustomizerPage, Viewer and three.js on `/create`, after the worker and WASM
preloads), and the landing document preloads the hero AVIF with `imagesrcset`/`imagesizes`/`media`
generated from the same list the `<picture>` renders (`ConfiguratorShowcase/hero-image.ts`). The
`/` Link header no longer preloads images. After the owner-approved landing idle prewarm
(2026-11-04 entry) the landing page also prefetches the editor's files from the
`#route-prefetch` list in its document, under the same gates (after load, LCP quiet 1 s, idle,
skipped on Save-Data and 2G). Prefetched files enter the HTTP cache without running, so the
landing page never gains Customizer CSS. The hero name form counts as editor intent like a
`/create` link. Consented PostHog starts after the boot hand-off and an idle slot (2 s timeout)
instead of in the first effect; events queue until then. opentype.js on the main thread loads only
when a local font is imported or restored.

**Rationale:** Each route chunk was requested only after the entry ran, and the Viewer and
three.js only after the Customizer mounted, so cold loads ran as a chain of round trips. The 1x
mobile Link preload named the 490w file while 390 px phones pick 390w, a wasted download, and
desktop had none.

**Consequences:** One hero request per device, matching `currentSrc`. vendor-opentype is no longer
in the Customizer chunk graph. `useRoutePreload` matches `[data-preload-route="create"]`.

## 2026-11-07 — Design cards load sized AVIF/WebP

**Decision:** Template and style cards render a `<picture>` (`display: contents`) with AVIF and
WebP at 240/480/720 w from `pnpm assets:landing` under `/showcase/v1/cards/`, `sizes` matched to the
measured card crops, lazy loading, and the PNG as fallback. A template's default style uses the
template image's URL when the renders are identical (name keychain and plant label contour, magnet
ribbon). The generator never rewrites an existing `/showcase/v1/` file, because that path is
served immutable; `--check` reports missing derivatives. The landing magnet card gained its v1
derivative.

**Rationale:** A cold `/create` downloaded eleven 1280×720 PNGs (about 490 KB) for cards about
120–260 CSS px wide; the sized AVIFs are 14 KB on desktop and 21 KB on a 2x phone.

**Open:** The six `styles/magnet-*.png` previews are byte-identical to the name keychain renders and
show a keyring hole a magnet does not have; they need recapturing (`pnpm capture:ui`). Unreferenced
camera originals (`prints/example_{1,2}.jpeg`, 7.4 MB) and the mobile template captures were
removed; `e2e/capture.spec.ts` now writes mobile captures under `artifacts/`.

# Open Keychain decisions

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

**Decision:** Separate-colors export keeps one model and mesh with Core material regions. Add
Prusa-compatible named volume ranges carrying each selected hex color. Do not export the backing
and relief as independent build objects or inject a printer configuration to force display colors.

**Evidence:** PrusaSlicer 2.9.6 CLI drops Core display colors, imports independent component objects
as separate models, and preserves the named-volume form as one aligned model. The 30-file slicer
gate and ten separate-color roundtrips preserve volume bounds and color references with no repairs.

**Consequences:** The file carries the selected palette, while users assign matching filaments in
PrusaSlicer. Export details show the hex references. Geometry/slicer validation is not physical-print
or automatic filament-mapping proof.

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
SlidersHorizontal icon beside Export and Share. Rendered preview aspect must match displayed canvas
aspect; capture readiness includes a completed resize render.

**Evidence:** User decisions on 2026-10-05, ALEX/Nunito 0.6/0.8 mm reproduction, native generation
regressions, and focused responsive wizard/color captures.

# Open Keychain decisions

## Design choices and dependent controls form one unit

**Status:** active

**Decision:** The Customizer follows `Name → Template → Template details → Style → Style details →
Refine → Print`. Controls that exist because of a template or style appear immediately after that
selection in a shared companion-details treatment. Inapplicable sections are omitted, and selections
without adjustable details do not render empty panels.

**Evidence:** Current user direction; the Template and Style card rails in `ControlsPanel.tsx`; the
currently separated Magnet, parameter-group, Geometry Finish, and Heart-center sections;
`docs/design-concepts.md` and `AGENTS.md` progressive Workshop guidance.

**Rationale:** Proximity communicates ownership. A user should not need to infer that a range buried
under Shape belongs to the Heart style selected much earlier.

**Consequences:** Heart size, border, left/right gaps, vertical offset, and center treatment stay
together under Heart Style details. Template hardware/mechanics stay under Template details. Common
typography/visual controls stay under Refine and manufacturing controls under Print. Reuse shared
cards, field stacks, reset actions, disclosures, and statuses instead of creating a local layout for
each template or style.

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

## Local-first customizer and optional hosted boundary

**Status:** active

**Decision:** Geometry generation, preview, and STL/3MF export stay in the browser and remain free
in the default workflow. Accounts and the Fastify/PostgreSQL service are optional hosted-workspace
groundwork; seller presets may persist, while CSV names, generated geometry, and batch ZIPs remain
local.

**Evidence:** `README.md`, `docs/hosting-readiness.md`, `docs/seller-research.md`, and hosted API
validation rules.

**Rationale:** The documented product is local-first and limits hosted seller value to measured
order-processing work.

**Consequences:** Do not move ordinary generation/export server-side, add billing by implication,
or persist customer text in seller presets.

## Vite/React SPA remains the SEO delivery model

**Status:** active

**Decision:** Keep Vite/React with one static application entry and Netlify SPA fallback; render SEO
catalog and metadata in the client application.

**Evidence:** `docs/adr/0001-vite-react-seo.md`, `netlify.toml`, and `docs/seo.md`.

**Rationale:** Geometry, WebGL, workers, and browser font handling already share a browser-first
runtime; server rendering would add a separate build/runtime contract.

**Consequences:** Revisit only if server-rendered or build-time SEO becomes a hard requirement.

## Version 6 design documents are the share contract

**Status:** active

**Decision:** Persist/share structured v6 design documents. Older v5 share payloads are unsupported;
unbundled fonts are replaced with a bundled fallback in shared links.

**Evidence:** `docs/geometry-roadmap.md`, `src/domain/keychain/design-document.ts`, and its tests.

**Rationale:** The schema separates semantic design sections while preventing font bytes from being
embedded in URLs.

**Consequences:** Preserve strict decoding and explicit fallback behavior. The removed legacy
`separateParts` payload field is ignored for compatible v6 decoding; it is not a current design
parameter.

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

## Hosted deployment is a guarded beta operation

**Status:** active

**Decision:** The optional API is a loopback-only Compose deployment behind Nginx, with PostgreSQL
not publicly exposed. Enable hosted mode only after migration, TLS/proxy, firewall, backup/restore,
health, and isolated hosted-E2E evidence.

**Evidence:** `docs/hosting-readiness.md`, `deploy/hetzner/docker-compose.yml`, hosted E2E config,
and server configuration.

**Rationale:** The documented CX23 arrangement is single-server beta infrastructure, not a strong
uptime guarantee.

**Consequences:** Keep secrets outside Git, use disposable local databases for hosted E2E, and do not
claim live readiness from repository assets alone.

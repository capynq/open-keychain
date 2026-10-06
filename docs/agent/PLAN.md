# Open Keychain execution plan

## Current objective

Make the Customizer predictable across every template and style: related choices must read as one
coherent workflow, every visible control must have an understandable effect, and a failed geometry
candidate must never leave the controls describing a different design from the preview.

The feedback slice adds independent base and front-only text finishes, sidebar colors, optional
focused setup with persistent size envelopes/font preferences, configurable keyring openings and
attachment edges, and verified Prusa-compatible 3MF material volumes. Selected
palette references survive import; matching physical filaments remains a slicer action.

## Setup wizard slice

Implemented: Name & size → Keyring position → Opening → Font styles → Colors → Review (the two keyring steps appear only for supported templates). Keep setup optional,
exclude template selection, and keep precision controls in the editor. Use library action icons, real font specimens, content-sized font chips, short labels, preserved drafts, transactional application, and a stable header/action footer.
Completion requires every step to pass keyboard, cancellation/rejection, localization, 320 px,
mobile/mobile-2x, text-zoom, and visual-capture checks without clipped text or hidden actions.

The follow-up slice removes pointer-triggered outlines, caps modal width at 600 px, redesigns
sidebar colors, and replaces failing text bevel conversion with native front contour bands and
verified limits. The latest follow-up restores independent base finishing in v11, reads v6-v10,
centralizes actual/maximum metrics, moves setup into header actions, and fixes proportional captures. Completion
requires the geometry regressions, responsive UI captures, current repository gates, and export
mesh/material validation. Current evidence and review boundaries are in
`STATE.md`.

## Current milestone

### Active — Customizer coherence and safe geometry updates

**Intended outcome:** A user can move from name to template, template details, style, style details,
refinement, and print settings without hunting through unrelated sections. Non-range choices stay
beside the choice that activates them; all range inputs live in one Adjustments section with
contextual subcategories. Manual edits, randomization,
reset, restored designs, and tool-driven changes share one safe candidate-validation contract.

**Important constraints:**

- Preserve the Workshop visual system, native inputs, localized copy, parameter values, geometry
  semantics, reset behavior, persistence, sharing, and browser-local export.
- Treat the parameter and template/style catalogs as product contracts; do not duplicate
  applicability rules in presentation-only conditionals.
- Keep copy compact. Selected state, preview response, progress, and recovery should explain the
  interaction; technical detail belongs in a disclosure.
- Do not silently clamp or substitute geometry after generation fails. Known range normalization may
  prevent impossible input, but rejected candidates return to the last accepted design.
- Automated topology, matrix, browser, and slicer checks remain distinct from physical-print proof.

**Completion criteria:**

- Non-range controls follow `Name → Template → Template details → Style → Style details`; all
  applicable sliders appear exactly once in one Adjustments section, grouped into Typography, Shape,
  Template details, Style details, and Print subcategories. Empty subcategories are omitted.
- Each supported template and style has an explicit owner for every dependent control, and no
  active control is stranded in an unrelated generic group.
- Heart ranges appear together under the Style details subcategory in Adjustments; the discrete
  center-treatment choice stays beside the Heart selection.
- A candidate is committed to controls, persistence/share state, and preview only when its current
  geometry result succeeds. A rejected candidate restores the last valid value and preview together.
- Rapid interaction is latest-candidate-wins; superseded results and errors cannot replace newer
  accepted state.
- Errors from normalization, font preparation, generation, workers, empty/non-finite meshes,
  topology, connectivity, cancellation, and timeouts produce bounded fallback behavior rather than
  uncaught failures or a stale-preview/control mismatch.
- Every visible geometric control changes the preview or a clearly identified measured property at
  representative safe values. Invalid combinations provide a localized warning naming what was
  rejected and one relevant recovery action.
- Focused domain and browser regressions cover all catalogued templates/styles, the reproduced Heart
  plus edge-finish failure, rapid changes, persistence/share/export state, keyboard use, reduced
  motion, and desktop/mobile/mobile-2x layouts.

## Milestones

### Completed — public MIT product foundations

The browser customizer, geometry validation, free single STL/3MF exports, local batch workflow,
localized SEO, consent-gated analytics, native WebMCP, and the subscription UI/public `/api/v1`
DTOs and mock fixtures are in the public MIT repository. This is implementation status, not current
release or physical-print evidence.

The public repository intentionally excludes the hosted service implementation, deployment/provider
internals, billing operations, and email delivery. Those belong to a separate private service. The
private repository/service has not been created or transferred in this worktree; creation, transfer,
implementation, deployment, and operation remain blocked pending explicit authorization and an
external repository. No commit, push, or deployment is implied by this plan.

### Active — unify choice hierarchy and dependent controls

Use the canonical catalogs and parameter registry to define which companion controls belong to each
selection. The detailed coverage matrix and acceptance signals live in `BACKLOG.md`.

Major workstreams:

- Keep non-range template and style choices directly after their selector. Put every range control in
  the unified Adjustments section, categorized by Typography, Shape, Template details, Style details,
  or Print. Styles without non-range details retain only their selected card and concise description.
- Standardize cards, field stacks, reset affordances, disclosures, status treatments, spacing, and
  semantic interaction feedback instead of creating per-template UI dialects.
- Make the responsive ordering preserve the same conceptual sequence even when the controls and
  preview change layout.

**Dependencies:** Existing `TEMPLATE_CATALOG`, `STYLE_CATALOG`, parameter applicability/range data,
Workshop primitives, localization keys, and focused design-system captures.

**Completion signal:** All five templates and all applicable styles follow the same hierarchy, and
the template/style coverage tests fail if a new catalog entry lacks presentation ownership.

### Active — make parameter application transactional

Introduce a single update path for sliders, selects, text/font changes, template/style switches,
randomization, reset, restored/shared designs, and tool-applied designs:

1. Normalize a proposed candidate and mark its affected group as checking.
2. Generate and validate it under a candidate signature/request identity.
3. On success, atomically accept the parameters, fonts, and geometry result.
4. On failure, discard the candidate, keep the last accepted design everywhere, and show one
   localized recovery action at the responsible control group.
5. Ignore completion from superseded candidates; diagnostic detail may be disclosed but must not
   replace the plain-language problem and recovery.

**Completion signal:** No supported interaction can leave an invalid value visible while the preview,
share/export state, or persisted state still represents an older design.

### Next — current-HEAD release evidence

- Run the repository validation ladder, geometry matrix, and applicable release browser checks after
  the active Customizer milestone is complete.
- Produce a slicer smoke manifest when PrusaSlicer is available; preserve its distinction from
  physical-print evidence.
- Resolve regressions before treating the beta as release-ready.

**Dependencies:** Node 22+ and pnpm 10; Chromium for browser checks; PrusaSlicer only for the opt-in
slicer smoke check.

### Future — physical print evidence

- Complete the baseline 0.4 mm PLA/no-support rows and high-risk repeats in
  `docs/print-validation.md`.
- Record printer/profile, dimensions, observations, slicer warnings, and evidence links.

**Completion signal:** Every supported baseline template/style row has recorded physical evidence.

### Blocked — private hosted subscription service

The intended hosted product is a separate private service for accounts, subscription enforcement,
and synchronized reusable presets; the public client keeps customer text, generated geometry, and
batch ZIPs local. Creating or transferring the private repository, implementing the service, and
operating its provider/deployment stack require explicit authorization plus an external repository.
Do not add private service code, credentials, deployment claims, or production integrations to this
public checkout.

**Unblock signal:** explicit authorization and a supplied external private repository, followed by
separate service design, implementation, security, billing, and operational validation.

### Future — evidence-led seller research

Continue public research and draft preparation without sending outreach. Commercial subscription
validation and any seller pilot require the separately operated private service and explicit human
approval; retain only aggregate evidence and keep the broader physical-print matrix distinct from
recipe-specific evidence. Exact pricing is a later product decision, not a reason to reintroduce
hosted internals into this repository.

### Future — optional product exploration

Editable artwork/feature UI, SVG import, complex-script shaping, a unified outline-margin control,
articulated swept-motion checks, arbitrary constructive-geometry manufacturing checks, and new
templates/styles remain documented possibilities, not active commitments.

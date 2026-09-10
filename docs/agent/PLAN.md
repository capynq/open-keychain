# Open Keychain execution plan

## Current objective

Make the Customizer predictable across every template and style: related choices must read as one
coherent workflow, every visible control must have an understandable effect, and a failed geometry
candidate must never leave the controls describing a different design from the preview.

## Current milestone

### Active — Customizer coherence and safe geometry updates

**Intended outcome:** A user can move from name to template, template details, style, style details,
refinement, and print settings without hunting through unrelated sections. Template- and
style-specific controls sit beside the choice that activates them. Manual edits, randomization,
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

- The control sequence is consistently `Name → Template → Template details → Style → Style details
→ Refine → Print`; sections that do not apply are omitted rather than left empty.
- Each supported template and style has an explicit owner for every dependent control, and no
  active control is stranded in an unrelated generic group.
- Heart size, border, left/right gaps, vertical offset, and center treatment form one Style details
  block directly beneath the Heart selection.
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

### Completed — local-first product foundations

The browser customizer, STL/3MF export, localized SEO, consent-gated analytics, native WebMCP, and
optional hosted seller-workspace code are implemented. Commits `6dead43`, `114e9fc`, `5a711ee`,
`8e7bed2`, and `996e6b2` added the latest geometry, finish-control, export, seller, and public-surface
work. This is implementation status, not current release or physical-print evidence.

### Active — unify choice hierarchy and dependent controls

Use the canonical catalogs and parameter registry to define which companion controls belong to each
selection. The detailed coverage matrix and acceptance signals live in `BACKLOG.md`.

Major workstreams:

- Put template-specific settings directly after Template and style-specific settings directly after
  Style. Styles without adjustable details retain only their selected card and concise description.
- Keep common typography and visual refinement after the design choices; keep thickness, relief,
  edge finish, tolerances, and other manufacturing controls in Print.
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

### Future — optional hosted pilot readiness

- Verify disposable-database hosted E2E; deploy and operate the optional Hetzner API only after DNS,
  TLS, proxy, migration, backup/restore, firewall, and health checks are evidenced.
- Enable `VITE_HOSTED_MODE` only after those gates pass; keep CSV names, generated geometry, and
  batch ZIPs in the browser and seller presets free of customer text.

**Completion signal:** The documented three-path health checks, restore drill, and hosted E2E have
evidence suitable for inviting pilot sellers.

### Future — evidence-led seller pilots

- Research public seller demand, prepare human-approved drafts, and offer concierge batches for
  feedback.
- Consider pricing only after three completed pilots and an explicit paid commitment.

**Dependencies:** Physical and hosted-pilot readiness. Outreach and sending remain explicit
human-approved actions.

### Future — optional product exploration

Editable artwork/feature UI, SVG import, complex-script shaping, a unified outline-margin control,
articulated swept-motion checks, arbitrary constructive-geometry manufacturing checks, and new
templates/styles remain documented possibilities, not active commitments.

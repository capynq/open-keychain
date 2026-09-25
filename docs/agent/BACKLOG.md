# Open Keychain backlog

Status labels distinguish confirmed work, investigation, and optional ideas. Priorities apply to the
local-first beta and optional hosted seller pilot; they do not authorize deployment or outreach.

## P0 — correctness / release blockers

### Confirmed — prevent invalid controls from diverging from the preview

**Problem:** Manual control updates currently enter `KeychainParams` before geometry succeeds. When
generation rejects a candidate, the previous mesh remains visible while the new control values remain
selected. On 2026-09-10 the deployed Customizer reproduced this with Heart and chamfered edge values:
the status became “Needs attention” with “Not manifold,” but the preview continued showing the last
valid Heart. This makes valid ranges appear unresponsive and leaves controls, persistence/share state,
and rendered geometry with different meanings.

**Evidence:** On 2026-09-10 the deployed Customizer reproduced the mismatch described above. The
current implementation keeps candidate and accepted parameters separately, validates candidates
through `GeometryClient.validate`, adopts only the matching result, and sends accepted parameters to
share/export. Catalog presentation ownership and Heart's adjacent details block are implemented.
Browser regressions cover a rejected candidate, latest-candidate-wins, and export gating. The exact
historical Heart/chamfer parameter values are not recorded in this checkout, so the rejection test
injects a worker error and does not claim to reproduce that exact geometry failure.

**Desired outcome:** All design-changing entry points use one transactional candidate lifecycle:

1. Keep the accepted parameters, resolved fonts, geometry result, and input signature as a last-valid
   checkpoint.
2. Hold an edit as a candidate and show `checking` at the affected control group while generation and
   validation run.
3. Atomically commit the parameters, preview, persistence, share/export state, and relevant history
   only after the matching candidate succeeds.
4. On failure, discard the candidate and restore the accepted control value and preview together.
5. During rapid interaction, allow only the newest candidate to commit or warn; ignore superseded
   completions without resetting busy/error state for the current request.

**Failure coverage:** Catch and classify normalization/range failures, missing or incompatible font
data, generator throws/rejections, worker initialization/crashes, cancellation, timeouts, empty or
non-finite results, non-manifold/topology failures, and unexpected disconnected output. Unexpected
errors must remain diagnosable without leaking raw technical text as the only user message.

**Fallback and warning contract:** Do not silently clamp, switch a style, or choose a nearby geometry
value after generation fails. Keep the previous accepted design and show a localized warning beside
the responsible group, for example: “Chamfer could not be applied to this Heart. Kept the previous
edge finish.” Provide exactly one useful action such as “Use sharp edges” or “Reset Heart details.”
Technical diagnostics may appear in a native disclosure. Use a non-duplicating live region; do not
move focus or flood toasts while a range is dragged.

**Dependencies:** A single owner for candidate/accepted state; stable input signatures covering
parameters and fonts; existing geometry cancellation/supersession behavior; localized error mapping.

**Remaining acceptance:** Recover the exact reported Heart configuration and add it as a geometry
fixture. Broaden regression coverage for persisted/shared/exported state and restore/WebMCP entry
points; verify worker timeouts and the full failure taxonomy. Rejected or superseded candidates must
not alter accepted state, overwrite a newer result, create an unhandled rejection, or present stale
geometry as current. Manual edits, randomization, reset, template/style changes, and current direct
parameter application already enter the candidate acceptance boundary.

### Confirmed — prove that exposed controls are effective and safe

**Problem:** A visible slider can appear broken when it selects its existing value, changes geometry
too subtly to perceive, is overwritten by a stale result, or combines with another supported option
to fail generation. Current focused coverage does not establish that every active control has an
observable effect for every owning template/style.

**Evidence:** The deployed Heart diagnostic showed size, border, and left gap generating new results;
right gap and vertical offset did not regenerate because the clicked values equaled their current
defaults. Chamfered edge values then triggered the actual failure. The parameter registry documents
dependencies, but the browser suite lacks a catalog-wide control-effect contract.

**Desired outcome:** Add registry-driven tests for every active geometric control at representative
safe minimum/default/maximum values, plus pairwise coverage for known dependent and high-risk
combinations. Compare a geometry fingerprint or affected measurement, then check finite meshes,
topology, `solidCount`, and intended connectivity. Intentional Heart assemblies remain distinct from
unexpected disconnected output.

**Acceptance:** The supported matrix has no unexplained no-op controls. A value with no meaningful
effect is corrected or removed from that context. High-risk combinations include every style with
edge finish, Heart size/border/gaps/interior modes, articulated joint dependencies, nameplate
tilt/embed/corner radius, magnet pocket placement, and plant-label stake/outline controls.

## P1 — current Customizer milestone

### Confirmed — standardize the choice-to-details hierarchy

**Outcome:** Make the left panel read in one stable order:
`Name → Template → Template details → Style → Style details → Refine → Print`.

**Evidence:** This was the prior hierarchy. The current `ControlsPanel` places template and style
details beside their selectors, and the parameter registry assigns each active control to one
presentation owner. The catalog ownership test and focused desktop browser test cover this structure.

**Implementation direction:** Extend canonical template/style/parameter metadata with presentation
ownership and order. Render a shared companion-details pattern directly beneath its selected card
rail. Reuse `.control-section`, field stacks, native selects/ranges, reset buttons, disclosures, and
Workshop status treatments. Do not duplicate applicability in component-local conditionals. A choice
with no adjustable details shows its selected card and one concise effect description—never an empty
panel or permanent explanatory wall.

**Remaining acceptance:** The ownership matrix and key keyboard/focus/localization checks pass.
Broaden responsive interaction checks and reset/persistence coverage across every template and style;
new catalog entries must continue to fail the test if any active parameter lacks exactly one owner.

### Confirmed — template companion-control coverage

| Template         | Adjacent Template details                                                                            | Style availability                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Name keychain    | Keyring hole diameter and offset                                                                     | Contour, Capsule, Soft tag, Bubble, Arch, Ribbon, Heart |
| Articulated name | Keyring hole/offset, connector width, joint clearance, mechanical gap, maximum angle, and joint boss | No Style section                                        |
| Magnet           | Magnet pocket preset and placement                                                                   | Plain, Contour, Capsule, Soft tag, Bubble, Arch, Ribbon |
| Nameplate        | Text tilt, embed depth, and corner radius                                                            | No Style section                                        |
| Plant label      | Stake length, stake shoulder, and plant accents                                                      | Contour, Capsule, Soft tag, Bubble, Arch                |

**Placement rule:** These controls appear immediately after Template because they describe the chosen
object or its hardware. Common text size/weight/spacing and general outline refinement remain in
Refine. Base/relief thickness, edge finish, and manufacturing-specific fine tuning remain in Print.

**Acceptance:** Switching template updates the companion block as one understandable transition,
removes irrelevant settings, keeps applicable saved values, normalizes unsupported style choices, and
does not expose an empty Style heading for Articulated name or Nameplate.

### Confirmed — style companion-control coverage

| Style    | Adjacent Style details                                                   | Applicability notes                |
| -------- | ------------------------------------------------------------------------ | ---------------------------------- |
| Plain    | Corner radius                                                            | Magnet only                        |
| Contour  | No dedicated range; selected card and concise contour effect             | Name keychain, Magnet, Plant label |
| Capsule  | No dedicated range; selected card and concise capsule effect             | Name keychain, Magnet, Plant label |
| Soft tag | Tag tail                                                                 | Name keychain, Magnet, Plant label |
| Bubble   | Bubble lobe                                                              | Name keychain, Magnet, Plant label |
| Arch     | Arch curve                                                               | Name keychain, Magnet, Plant label |
| Ribbon   | Tail and notch; corner radius where the Magnet contract allows it        | Name keychain and Magnet           |
| Heart    | Size, border, left gap, right gap, vertical offset, and center treatment | Name keychain only                 |

**Heart presentation:** Use the same visual rhythm as the Template/Style selector block. Keep all six
Heart options in one adjacent Style details unit, with related gaps paired where width permits and
native single-column flow on narrow screens. Preview/status feedback must identify which Heart or edge
setting is checking, accepted, or rejected. Do not leave center treatment after Geometry Finish.

**Acceptance:** Selecting a style reveals only its details, preserves applicable values across safe
switches, and makes the effect visible without extra instructional paragraphs. Style reset restores
that style's defaults as one candidate transaction.

### Confirmed — standardize feedback, recovery, and interaction states

**Outcome:** Use a shared vocabulary and presentation for `checking`, `applied`, `rejected`, `ready`,
`attention`, `blocked`, and `unverified` states.

**Evidence:** `docs/design-concepts.md` requires state-led Workshop behavior and one recovery action,
while current geometry errors surface in summary feedback without identifying the control that caused
the rejected candidate.

**Acceptance:** Range dragging stays calm and coalesced; selection, preview update, disclosure,
success, and rejection are the only motion triggers. Applied state is primarily visible through the
preview and selected treatment rather than success toasts. Warnings use sentence case, plain user
language, a control-specific recovery, and an accessible announcement. Reduced motion removes
nonessential transforms.

### Confirmed — validate responsive comprehension and accessibility

**Outcome:** Ensure the unified hierarchy remains obvious when the left panel scrolls or changes
layout.

**Acceptance:** Focused Playwright coverage and design-system captures inspect desktop, mobile, and
mobile-2x; no clipping, overlap, off-screen recovery action, focus loss, or unexpected scroll jump is
present. Native range/select keyboard behavior and screen-reader labels remain intact. EN, RU, and UK
copy names the affected choice consistently and does not expose raw worker errors as primary copy.

## P2 — release and pilot follow-up

### Confirmed — establish current-HEAD automated release evidence

**Outcome:** After the P0/P1 Customizer work is complete, validate the resulting release candidate
rather than relying on prior-run results.

**Evidence:** `docs/release-checklist.md`, `docs/geometry-roadmap.md`, and `CONTRIBUTING.md` require
CI-equivalent, geometry, and browser evidence for release claims.

**Acceptance:** Preserve the exact outcomes of `CI=true pnpm validate:ci`, the geometry matrix, and
applicable release browser checks; investigate failures before release work continues.

### Confirmed — complete baseline physical-print validation

**Outcome:** Populate the pending 0.4 mm PLA/no-support baseline table and high-risk repeats.

**Evidence:** Every row in `docs/print-validation.md` is pending; automated and slicer results are not
physical-print proof.

**Dependencies:** A printer, baseline material/profile, and retained observations/photos.

**Acceptance:** Each supported baseline row records printer/profile, measurements, observations, and
evidence; highest-risk fixtures are repeated as documented.

### Confirmed — verify optional hosted-pilot operational gates

**Outcome:** Make the Fastify/PostgreSQL workspace safe to enable for pilot sellers.

**Evidence:** `docs/hosting-readiness.md`, `deploy/hetzner/`, hosted E2E, and the hosted-mode feature
flag require disposable E2E, DNS/TLS/proxy/firewall, backup/restore, and three-path health evidence.

**Dependencies:** Explicit authority and access for Hetzner/Netlify operations; no production
credentials in repository or chat.

**Acceptance:** Hosted E2E uses an isolated disposable database; deployment and recovery checks have
recorded evidence; seller presets exclude customer names and subtitles.

## P3 — optional documented follow-up

### Confirmed — run the seller research and concierge-pilot loop

Run public research and human-approved pilot outreach only after physical and hosted readiness. Keep a
consent-respecting lead ledger; do not create synthetic accounts or automate sending. Consider pricing
only after three completed pilots and an explicit paid commitment.

### Optional — extend geometry authoring only through validated slices

Editable artwork/features, SVG import, complex-script shaping, unified outline margin, articulated
motion checks, arbitrary constructive-geometry manufacturing checks, and candidate templates/styles
remain ideas rather than commitments. Any public addition must meet the typed-schema, localized UX,
topology/export, visual-capture, and physical-print gates.

### Optional — add polish only when it communicates state

Additional animation, microcopy, or ornament is not committed work. Consider it only when it makes a
selection, geometry update, disclosure, progress state, success, or recovery materially clearer and
still respects reduced motion.

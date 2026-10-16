# Product design concepts

This is the visual contract for people and agents adding user-facing work.

## Three systems

**Maker Editorial** is for the landing page. It sells the feeling of making a real
object: lead with a real model or result, one clear action, and short proof. Its
sections earn their shape from a story or decision; it is not a generic card grid.

**Reference** is for template, guide, and SEO pages. It is quiet, scannable, and
useful. One page has one purpose, one primary CTA, readable line lengths, and no
repeated landing-page persuasion.

**Workshop** is for `/create`, export, profile, and seller flows. It is calm but
alive: selected choices, regenerated preview, progress, and print states show what
changed. Make comes first; precision and manufacturing controls are contextual.

New-design entry offers an optional focused Workshop setup: **Name & size → Keyring position →
Opening → Font styles → Colors → Review**. The two keyring steps appear only for supported templates.
Template selection and precision controls stay in the editor. No size is selected
for a fresh model; selected dimensions remain an upper bound. Favorite categories hide other groups
until Show all or an explicit search. Keep colors directly after Name in the editor. Base and text
finishes use separate profiles; text finishing affects only its visible front edge.

### Progressive setup contract

- Setup is capped at 600 px on desktop. Font choices wrap at their natural width with modest padding;
  do not force equal-width category cards. Native checkboxes have a rounded styled surface.
- Pointer clicks do not add a focus outline. Keyboard focus has one visible ring, separate from the
  single selected border and tint. Keep native color fields balanced and reset each color separately.
- Color controls are solid rounded squares with a 4 px inset and only a bold uppercase hex value
  inside. Base/Text labels and independent reset actions sit outside; setup squares are larger than
  sidebar squares. Choose black/white text for contrast and preserve native color input behavior.
  Quick setup uses a library icon in
  the header action row beside Export and Share. Actual model metrics and the selected maximum
  size are distinct labels derived from one accepted-state metrics selector.
- Preview drawing-buffer proportions must match the displayed canvas. Captures wait for stable
  layout and a completed resize render; larger mobile assets use the native 2x capture.

- Render one step at a time, with one short heading and at most one helper sentence. Never combine
  every setup parameter into a single crowded modal.
- Prefer icon-led selection cards with short visible labels; icon-only Close, Reset, and Edit actions
  require accessible names. Preserve native input semantics and 44 px minimum touch targets.
- Keep the header and actions visible while the step body scrolls. Labels must wrap, never clip or
  truncate essential choices. Check 320 px width, EN/RU/UK, 200% text zoom, and mobile keyboards.
- Back, Next, and review Edit preserve draft choices. Closing discards unsubmitted changes; reopening
  starts from accepted settings. Commit colors/preferences only after geometry acceptance.
- Use state-led spring motion and Workshop tokens. Reduced motion removes transforms; no decorative
  background animation. Use library icons for actions and real bundled-font specimens for font categories. Do not draw
  category glyphs or action icons as custom SVG paths.

## Interface rules

### Simple and Pro editor — visual review pending

- Simple is the default editor mode; remember an explicit Simple/Pro choice locally. Changing modes
  changes the controls shown, never the design, fonts, colors, size limit, or hardware selection.
- In Simple, use two or three named choices for a meaningful parameter or coupled group, with a
  library icon or bundled-font specimen and a short description. Keep precise dimensions and
  calibration in Pro. Preserve unmatched values and label them Custom instead of selecting the
  nearest preset.
- Keep the existing template/style catalogs authoritative for applicability. Heart size and border
  form one choice; articulated motion is separate from joint calibration. Keep existing opening and
  attachment-position pickers in both modes. Base and text finishes remain independent.
- Keep rejection/checking feedback visible in both modes, even when a Pro-only parameter caused it.
  Each Simple adjustment group has a Fine tune in Pro action. After Pro mounts, scroll to the
  matching group and focus its heading without a second scroll; fall back to Adjustments if the
  group is unavailable. Use the desktop rail/mobile scroll ancestor and respect reduced motion.
- Simple fonts use a horizontal carousel of fixed pages with up to three compatible bundled fonts
  per page, with clickable current-page dots below. Swiping/pages never changes the model; primary
  and subtitle browsing remain independent. Choose font opens the shared searchable bundled,
  Google, and local browser in a native dialog; selection closes it only after geometry acceptance
  and keeps Simple mode. Closing while a font is loading must not apply it later.
- Chamfered/Rounded profiles reveal up to three distinct Light/Medium/Strong strengths, limited to
  verified 0.2 mm steps and a 0.8 mm Simple maximum. Backing strengths set equal top/bottom amounts;
  Pro preserves independent precision. Unmatched strengths show Custom while retaining the profile.
- The Customizer has no page footer. Header actions are at least 48 px; Export has a visible label
  and 52 px minimum height. On narrow screens, action groups wrap into separate rows. Center the
  whole bounded workspace rather than centering the preview inside an oversized right column;
  scale sidebar/type/preview together from laptop baseline to a maximum of 125% on ultra-wide
  screens without CSS zoom or transforms.
- Complete starting looks with coordinated fonts/colors and real model thumbnails remain the next
  slice. Visual approval precedes test/capture updates and automated test suites. Static type/lint
  integration checks and explicitly requested performance measurements may run during design work.

### Shared controls

- Prefer visual state and an action to explanatory paragraphs. Visible helper copy
  is one sentence, attached to its field. Details, slicer notes, and evidence use a
  native disclosure.
- Use `ready`, `attention`, `blocked`, and `unverified` consistently. A blocked or
  attention state names the issue and provides one recovery action.
- Use sentence case. Do not add decorative all-caps labels, duplicate CTAs, generic
  rounded-card kits, or non-semantic gradients.
- All controls preserve native semantics and have hover, active, and focus-visible
  states. Icon buttons declare `nudge`, `rotate`, `scale`, or `none`; motion must
  explain the action, keep the glyph optically centered, and disappear under reduced motion.
- Keep content and controls responsive at desktop, mobile, and mobile-2x. A preview
  or product visual must show real geometry, never a decorative placeholder.
- Group the sidebar's Keyring settings in one quiet inset panel. Opening choices pair
  proportionally scaled shape cues with measured sizes. Position selection reuses a responsive ALEX
  outline illustration in a transparent, bordered frame across the sidebar and setup. Its six radio
  targets map to the attachment locations for Left, Right, Top, Bottom, Top left, and Top right,
  with the selected localized label beneath the lettering. Do not draw a plaque outline around ALEX.
  Keep targets at least 44 px, spaced without overlap, and aligned to the drawing in both contexts.
  The supplied rounded ALEX outline image is a fixed guide and does not replace the actual
  preview. Use Lucide's natural ellipse glyph for oval slots. Keep radio inputs out of the
  text-field baseline, and stack opening choices when the panel is narrow enough to split names
  awkwardly.
- In the Customizer, keep every range input inside one `Adjustments` section. Use
  compact, unboxed subcategory headings for Typography, Shape, Template details,
  Style details, and Print; hide empty groups. Keep non-range choices beside the
  template or style that activates them.
- Keep the heading hierarchy semantic and visible: `h2` sections at 16px, `h3`
  subcategories at 14px, and nested `h4` control groups at 12px.
- Avoid generic headings that only repeat the parent category. Place typography
  ranges and the font-target switch directly under Typography; keep a nested
  heading only for a distinct group such as Subtitle controls.
- Separate main Customizer sections with one horizontal rule, 16px of vertical
  section padding, and 8px around the rule. Use shared spacing tokens for subgroup
  gaps and field stacks; keep ordinary spacing in grid/flex `gap` rules instead of
  sibling margins.
- In Adjustments, separate visible Template details, Style details, and Shape
  `h3` subcategories with a quiet rule only when another such category precedes
  them. Do not leave rules after Typography or before Print when no detail
  subcategory follows. Keep nested `h4` groups with their parent.
- Keep card-rail navigation as a real, accessible icon button, centered over the
  list edge, styled with the Workshop accent and a high-contrast arrow. Show the
  next button while more cards are available and the previous button after the
  rail has scrolled from its start. Overlay both on their edge fades so each
  accent circle sits above the gradient, with no white backing panel. Use a
  restrained warm border and soft slate shadow to separate the accent from card
  imagery; animate their appearance and disappearance and respect reduced motion.
- Measure candidate-to-render delay by phase before changing preview quality. A
  temporary pixel-ratio or shadow reduction is appropriate only when browser
  profiling shows drawing is a meaningful part of the delay; geometry validation
  and exported mesh quality remain authoritative.

## Review gate

Before merge, verify the affected route's focused browser test and capture. Check
that no overflow occurs, keyboard focus is visible, reduced motion stays calm,
blocked states offer a recovery action, and permanent copy did not grow into a
second explanation of the control.

### Inspection and shared Workshop roles — visual review pending

Use 1× safe fit as the initial camera state with independent 0.25–4× lens zoom. Offer wheel/pinch,
buttons, and focused keyboard shortcuts; keep browser modifier shortcuts intact. Allow bounded pan
above 1×. Refinements retain inspection state; Fit and template changes clear zoom/pan and keep the
angle, while Home restores the angle too. Named views keep magnification and recenter pan.

Backing edge finish and Text edge finish are separate quiet groups. Nest their explicitly named
strengths under the activating profile with a subtle vertical rule; keep checking/rejection feedback
in the owning group. Sharp hides strength controls. Never couple the backing and text values.

Workshop visual roles live in `src/shared/constants/design/{palette,typography,dimensions,workshop}.css`.
Use the shared 16/14/13/12 type roles, adaptive image/font/compact choice roles, and common surfaces,
spacing, radii, and touch targets. Essential captions wrap and cards grow with text. Keep font chips
content-sized and preserve the other public visual systems. Pending approval: update the focused
design-system capture and verify desktop/mobile/mobile-2x, 320px, 200% text, EN/RU/UK, focus, reduced
motion, and ultra-wide layouts before calling the UI complete.

### Connected design choices and interaction response

Keep Style directly below Templates in one connected group, ahead of hardware controls. Keep their
headings, reset actions, and candidate feedback independent. Font pages use scroll snap and visible
page dots; do not replace the selected font while browsing. Default backing thickness must match the
Balanced preset (2.4 mm); the default Heart pair is 22 mm / 1.6 mm. Preserve true Custom values.

Share motion duration/easing tokens for hover, press, selection, dependent strength reveal, and setup
step changes. Keep modal chrome stable, show the active setup step distinctly, and preserve the
no-preselected-size rule for fresh setup. Reduced motion removes transforms/animated scrolling;
hover lifts apply only to fine pointers. No ambient animations or model rotation are introduced.

### Scrollable cards need room for interaction effects

Reserve shared block/inline rail gutters inside each scrollport so borders, hover lift/shadows, and
external keyboard focus rings remain visible. The font carousel uses border-box page padding:
each page still occupies exactly one viewport width, preserving dot/swipe/resize calculations.
Template/style rails use the same gutter tokens. A clipping ancestor cannot be escaped with z-index;
`overflow-x: auto` also prevents relying on `overflow-y: visible`. Do not remove focus feedback to
mask a clipping bug. Include first/middle/last hovered, selected, and focused cards in the next
approved desktop/mobile/text-zoom captures, including page transitions and resize.

### Simple font discovery continues inline

Start with every compatible font from the setup's saved categories. Without saved categories use
Calligraphic, Handwritten, and Rounded. Keep the selected provider variant visible in its existing
family card; do not duplicate that family or change the selected font merely while browsing.

The matching Plus card fills the next free slot after the last font. Check configuration, browser
connectivity, and known provider failure before requesting Google fonts. If online loading is
unavailable, fails, or has no unused compatible candidates, append up to nine randomly sampled,
unselected bundled/available-local fonts with category variety. Do not repeat shown families or
repack older partial pages. No automatic metadata request is introduced.

When neither source has more candidates, remove the Plus card entirely and update/clamp page dots;
keep Find a specific font below the carousel. Transfer focus to a surviving font or that persistent
button after a no-result request removes the action. Preload preview files only for current/next
pages and preserve rail effect gutters. Center the compact page dots (maximum 16rem) and wrap them into as many rows as needed so all
pages remain visible. Do not scroll or clip the dot list; keep the font-track scrollbar hidden and
retain touch/wheel/keyboard navigation.

### Sequential font discovery reveal

Animate successful discovery batches only: new page dots appear in order at 90ms intervals, and
new font cards cascade at 60ms intervals with the shared 220ms reveal duration. Previously displayed
cards/dots and initial page load remain still. Smoothly move to the first new page; width-only resize
alignment must not interrupt it. Keep the wrapping dot layout, page stride, hover gutters, and focus
recovery intact. Keyboard-focused cards/dots show immediately; reduced motion skips all reveal
animations and smooth navigation. Clear old batch animation state on target/text/category changes.

### Pro finish alignment

Pro finish headings, profile choices, and precision sliders share the full-width control edge.
Separate backing and text groups with vertical space and a quiet horizontal divider, rather than
nested card padding or an indented strength rail. Keep Simple's grouped preset presentation.

### Numeric readouts and usable parameter limits

- Essential numeric values, including preview zoom percentages, use an explicit opaque surface and
  foreground pair. Normal-size text must meet at least 4.5:1 contrast; target 7:1 for compact
  readouts. Never use inherited foregrounds, reduced opacity, or translucent overlays for values
  users need to read. Check default, hover, selected, focus, and disabled-adjacent states.
- Preview zoom uses Workshop on-dark text on its opaque dark surface, with bold tabular figures.
  Keep mounted and initial preview styles consistent; review 25%, 100%, and 400% on mobile/desktop.
- Numeric controls expose usable, step-aligned ranges. Share dependency constraints between the
  UI and candidate reconciliation; reconcile affected values atomically, without rewriting a
  restored design merely on load. Geometry-derived maxima use the actual text footprint and are
  revalidated before committing an adjusted candidate. Keep asynchronous request cancellation.
- Finish maxima preserve walls, contact, holes, topology, and final-model connectivity. Isolated
  finish-probe success is not full-model evidence. Do not broaden limits merely to hide rejection.

### Coordinate-based picker targets

Keyring marker targets use fixed 44 CSS px minimum width and height within the reference image.
Do not substitute rem-based minima: enlarging text can grow invisible target boxes into adjacent
markers even when the artwork is unchanged. Validate all target pairs at 320 px and 200% text
size in EN/RU/UK; ordinary text labels still enlarge and wrap.

Text-bearing template/style cards must retain content-driven height. Compact desktop rules may
reduce the image row and caption offset, but must not force an aspect ratio that clips the caption.
Verify caption bounds inside each card at ultra-wide/tall and enlarged-text layouts.

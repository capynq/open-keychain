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
- Native color swatches fill their controls with a 4 px inset. Quick setup uses a library icon in
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

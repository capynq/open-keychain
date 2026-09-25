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

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
- Use the Customizer spacing tokens for section padding, subgroup gaps, and field
  stacks. Keep ordinary spacing in grid/flex `gap` rules instead of sibling margins.
- Measure candidate-to-render delay by phase before changing preview quality. A
  temporary pixel-ratio or shadow reduction is appropriate only when browser
  profiling shows drawing is a meaningful part of the delay; geometry validation
  and exported mesh quality remain authoritative.

## Review gate

Before merge, verify the affected route's focused browser test and capture. Check
that no overflow occurs, keyboard focus is visible, reduced motion stays calm,
blocked states offer a recovery action, and permanent copy did not grow into a
second explanation of the control.

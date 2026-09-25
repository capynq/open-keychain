# Agent handoff

## Repository state

- **Branch/HEAD:** `main` at `d998da8` (`feat(customizer): unify range controls and profile previews`), two commits ahead of `origin/main`.
- The previous customizer hierarchy/candidate slice is `dec0a0f`; the unified ranges and preview measurement slice is `d998da8`.
- Current Customizer hierarchy, divider, and card-rail refinements are uncommitted. Nothing was pushed.

## Current objective and result

- Main Customizer sections use `h2` at 16px, adjustment subcategories use `h3` at 14px, and nested groups use `h4` at 12px.
- Font categories, parameter subgroups, and edge-finish headings now use `h4` when nested below an `h3`.
- Main section vertical padding is 16px, with 8px around each main divider; inner subgroup and field spacing stays on its existing tokens.
- Explicit `<hr>` separators divide each applicable main section; duplicated top borders were removed.
- A lighter `<hr>` separates visible Template details, Style details, and Shape adjustment categories only when another such category precedes them; no rules remain at empty category boundaries.
- Typography ranges and the font-target switch now sit directly under Typography without an extra `Font settings` heading; Subtitle remains a distinct nested group.
- Inner adjustment dividers are derived from the ordered visible subcategories and appear only between rendered headings.
- Template/style rails use circular accent next/previous buttons centered over the list-edge fades, with no white backing panels. A restrained warm border and soft slate shadow separate them from card imagery. Each fades/scales in and out at the relevant scroll boundary; the previous button appears after the rail moves 8px from its start. The controls respond to resize/content changes and respect reduced motion.
- `docs/design-concepts.md` records the heading scale. Existing range grouping and layout are unchanged.

## Validation actually run

- `pnpm typecheck` passed after the latest divider change.
- Focused Prettier checks and `git diff --check` passed after the latest divider change.
- No browser tests or UI captures were run for the current heading, separator, and card-rail changes.

## Exact next action

After approval, commit and push the reviewed Customizer hierarchy, divider, and template/style card-rail changes. Visually inspect headings, separators, and both card-rail buttons at desktop and mobile sizes when UI capture is available.

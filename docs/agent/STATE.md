# Agent handoff

## Repository state

- **Branch/base HEAD:** `main` at `e06bd8a` (`feat(seo): strengthen search indexing and discovery`).
- **Working tree:** uncommitted Customizer hierarchy, candidate-validation, regression, capture-config,
  and screenshot changes from the current task. No commit or push was performed.

## Current objective and result

Implement the active Customizer coherence milestone. The first integrated slice is complete:

- The controls follow Name, Template, Template details, Style, Style details, Refine, and Print.
  The parameter registry assigns each active geometric parameter to one owner, with a catalog-wide
  coverage test. Heart settings stay with Heart; Magnet and template mechanics stay with Template.
- Edits validate as candidates. Only the newest valid candidate becomes accepted state and updates
  the preview; rejected values restore the previous accepted design. Share/export inputs use the
  accepted parameters. Checking/rejection feedback is localized, names the setting, keeps technical
  details in a disclosure, and offers a control-focused recovery action.
- Desktop browser regressions cover template/style ownership, candidate rejection, latest-candidate
  wins, export gating, subtitle layout, and Heart rollback. Desktop, mobile 1x, and mobile 2x
  Customizer captures were regenerated and visually reviewed.

The milestone remains active. The historical deployed Heart/chamfer parameter values are not
available in this checkout, so the rejection regression injects a worker validation error; it does
not claim to reproduce that exact geometry failure. The full registry-driven control-effect matrix
and broader persistence/share/restore/WebMCP browser coverage remain follow-up work.

## Validation actually run

- `pnpm validate` passed: Prettier, full ESLint, TypeScript, 42 Vitest files / 510 tests, and
  production build. Build emitted the existing Vite `manifold-3d` `node:module`
  browser-externalization warning.
- Focused desktop Playwright regressions passed for template/style grouping, injected rejection,
  latest-candidate-wins/export gating, subtitle layout, and Heart rollback.
- Customizer capture test passed on desktop, mobile, and mobile-2x; screenshots passed dimension and
  rendered-model checks. The mobile capture config now distinguishes 1x from 2x output.
- `pnpm validate:changed` and `git diff --check` passed.

## Exact next action

Recover the original Heart/chamfer parameter values from an available deployment or diagnostic
record, then add them as a deterministic geometry fixture. Next, expand the registry-driven safe
control-effect coverage and exercise accepted-state consistency through restore/share/WebMCP flows.

# Agent handoff

## Repository state

- **Branch:** `main`
- **HEAD:** `996e6b2` (`style(ui): refine public surfaces and sharing`)
- **Remote relationship:** `main` and `origin/main` both point to `996e6b2`.
- **Working tree:** `docs/agent/` is untracked and contains the four coordination files. Those files
  existed before this UI/UX planning update and were updated in place. There are no staged files or
  other tracked/untracked changes.

## Current objective

Unify the Customizer's template/style hierarchy and make every geometry-changing interaction
transactional so visible controls, preview, persistence, sharing, and export always describe the same
accepted design.

## Relevant existing work

- Template and Style already use shared visual card rails, but their dependent controls are scattered
  through Magnet, Shape parameter, Geometry Finish, and Heart-center sections.
- `PARAMETER_REGISTRY` centralizes ranges, dependencies, randomization, and applicability; it does not
  yet provide one presentation owner for each Template details, Style details, Refine, or Print group.
- Manual `update` calls commit parameter values before geometry succeeds. The geometry hook retains the
  previous result on rejection and reports an error, allowing a stale-preview/control mismatch.
- Randomization already validates candidates before adopting them and is useful prior art for the
  shared transaction, but ordinary controls do not use that boundary.

## Recently completed

- `6dead43` added geometry validation and edge-finish foundations.
- `114e9fc` added Geometry Finish controls and focused preview/finish UX.
- This documentation run made Customizer coherence and safe candidate updates the active milestone,
  added complete template/style control ownership, and recorded the safe-reversion decision.

## Validation state

- A live deployed-browser diagnostic ran on 2026-09-10 with Heart text `I` / `KYIV`. Heart size,
  border, and left gap produced new geometry generations. Right gap and vertical offset did not
  regenerate when set to values already active in the design.
- The same diagnostic reproduced “Needs attention” / “Not manifold” after selecting Chamfered with
  non-zero top and bottom edge values. The last valid mesh remained while the rejected values stayed
  selected.
- `pnpm exec prettier --check docs/agent/PLAN.md docs/agent/STATE.md docs/agent/BACKLOG.md
docs/agent/DECISIONS.md` passed after the documentation update.
- `pnpm validate:changed` completed successfully; there are no tracked product-code changes in this
  documentation-only run.
- `git diff --check` passed; the untracked coordination files were checked separately for whitespace.
- No unit, build, geometry-matrix, local Playwright, hosted-E2E, slicer, deployment, or physical-print
  validation ran during this documentation update.

## Known failures / blockers

- Heart combined with the reproduced chamfered edge settings can reject generation as non-manifold and
  leave visible controls inconsistent with the retained preview.
- There is no focused Heart × edge-finish browser/domain regression or catalog-wide proof that every
  exposed control produces an observable safe effect.
- Physical-print evidence remains pending; hosted pilot readiness still requires external DNS, TLS,
  firewall, proxy, backup/restore, public-health, and isolated hosted-E2E evidence.

## Current uncertainty

- The exact geometric envelope that makes Heart edge finishing non-manifold is not yet isolated; it is
  unclear which combinations should be made constructively safe versus rejected with fallback.
- The full template/style/control interaction matrix has not been measured, so other no-op or
  cross-feature failures may exist.
- Current-HEAD CI, geometry-matrix, and release-browser validation have not been rerun after `996e6b2`.

## Exact next action

Add a failing regression for the reproduced Heart/chamfer configuration, then implement the shared
last-valid candidate transaction and adjacent Heart Style details block as one vertical slice.

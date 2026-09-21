# Agent handoff

## Repository state

- **Branch:** `main`
- **HEAD:** `996e6b2` (`style(ui): refine public surfaces and sharing`)
- **Remote relationship:** `main` and `origin/main` both point to `996e6b2`.
- **Working tree:** uncommitted slicer-validation work touches the geometry partition, 3MF/fixture
  contracts, diagnostics, print-validation documentation, and this handoff. No files are staged.

## Current objective

Make `3MF · separate colors` a true two-material export: its base and relief volumes meet without
positive-volume overlap, while the merged preview/STL/3MF model stays unchanged and sliceable.

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

- Added `partitionMaterialSolids`, which subtracts relief from the base and uses their union as the
  authoritative model for normal templates, articulated assemblies, Nameplates, and feature edits.
- Added representative-fixture contract coverage for material-boundary overlap, merged bounds, and
  separate/merged 3MF object structure. Nameplate relief now intentionally includes its embedded text
  volume, rather than an overlapping exposed cap.
- Improved slicer errors with fixture identity and exit-code/signal detail; repair, invalid, manifold,
  and G-code-path conflicts remain failures. The print-validation documentation now accurately says the
  smoke check slices STL and 3MF files and is not physical-print proof.

## Validation state

- `pnpm validation:fixtures` passed: 10 cases / 30 exports.
- Focused geometry-contract, feature-graph, serializer, and Nameplate tests passed (30 tests).
- `pnpm test:fast` passed: 39 files / 223 tests. `pnpm format:check`, focused ESLint, `pnpm typecheck`,
  `pnpm validate:changed`, `git diff --check`, and `pnpm build` passed.
- A full `pnpm validate` run reached its full Vitest phase but did not finish within the interactive
  command window, so it is not recorded as passing.
- `pnpm validate:slicer` correctly stopped because no local `prusa-slicer` binary or
  `PRUSASLICER_BIN` is available. No slicer, GitHub workflow, or physical-print proof exists yet.

## Known failures / blockers

- The local environment lacks the pinned PrusaSlicer binary, so the real slicer smoke result is pending.
- Manual workflow dispatch must wait for an explicitly approved commit; no commit or remote action is
  authorized in this run. Physical-print evidence remains pending.

## Current uncertainty

- The exact geometric envelope that makes Heart edge finishing non-manifold is not yet isolated; it is
  unclear which combinations should be made constructively safe versus rejected with fallback.
- The full template/style/control interaction matrix has not been measured, so other no-op or
  cross-feature failures may exist.
- Current-HEAD CI, geometry-matrix, and release-browser validation have not been rerun after `996e6b2`.

## Exact next action

Review the uncommitted slice, obtain explicit authorization to commit it, then manually dispatch the
PrusaSlicer workflow and retain its 30-export result manifest.

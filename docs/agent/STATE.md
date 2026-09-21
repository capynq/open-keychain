# Agent handoff

## Repository state

- **Branch:** `main`
- **HEAD:** `a508da9` (`fix(export): partition multi-material geometry`)
- **Remote relationship:** `main` and `origin/main` both point to `a508da9`.
- **Working tree:** an uncommitted follow-up changes 3MF separate-color assembly layout, preserves
  canonical export meshes/topology, and updates the geometry matrix contract. No files are staged.

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
- Follow-up investigation of PrusaSlicer 2.8.1 found that separate-color build items were treated as
  colliding print objects at their intended shared boundary. Separate-color 3MF now has one placed
  assembly with two named, colored mesh components; merged 3MF remains one direct mesh.
- Preserved the original authoritative combined export mesh and assembly topology for articulated,
  Nameplate, standard, and feature-modified models while subtracting the visible relief region from
  the base material mesh.
- Updated the geometry matrix to verify the current direct-mesh and assembled 3MF layouts.
- Improved slicer errors with fixture identity and exit-code/signal detail; repair, invalid, manifold,
  and G-code-path conflicts remain failures. The print-validation documentation now accurately says the
  smoke check slices STL and 3MF files and is not physical-print proof.

## Validation state

- `pnpm validation:fixtures` passed: 10 cases / 30 exports.
- Latest focused builder, material-partition, feature-graph, and serializer run passed (315 tests).
- `pnpm validate` passed: format, lint, typecheck, 40 test files / 497 tests, and production build.
- `pnpm validate:ci` passed: typecheck, build, format, lint, and 40 test files / 497 tests.
- `pnpm bench:matrix` passed: 4,267 cases; 4,264 passed and 3 documented expected-invalid cases;
  zero unexpected failures.
- `pnpm test:e2e:smoke` passed all 6 desktop/mobile checks after allowing the local preview bind.
- `pnpm validation:fixtures` passed: 10 cases / 30 exports. `pnpm validate:changed` and
  `git diff --check` passed.
- GitHub PrusaSlicer validation for `a508da9` failed on `art-cyrillic-separate.3mf` with a G-code
  path conflict between the two independent build items, followed by `SIGSEGV`. This follow-up
  assembly fix has not yet been pushed or sliced. Local PrusaSlicer is unavailable.

## Known failures / blockers

- The local environment lacks the pinned PrusaSlicer binary; GitHub workflow validation is needed for
  the follow-up commit. Physical-print evidence remains pending.

## Current uncertainty

- The exact geometric envelope that makes Heart edge finishing non-manifold is not yet isolated; it is
  unclear which combinations should be made constructively safe versus rejected with fallback.
- The full template/style/control interaction matrix has not been measured, so other no-op or
  cross-feature failures may exist.
- Current-HEAD CI, geometry-matrix, and release-browser validation have not been rerun after `996e6b2`.

## Exact next action

Commit and push the reviewed 3MF assembly fix, then rerun the PrusaSlicer and CI workflows and retain
the 30-export result manifest.

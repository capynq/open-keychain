# Physical print validation

Use 0.4 mm PLA, 0.2 mm layers, and no supports for the baseline. Complete one row for
each supported template/style combination before the first public launch.

## Repeatable PrusaSlicer smoke check

The opt-in `pnpm validate:slicer` command slices every generated STL fixture with the
checked-in `tools/slicer/prusaslicer-minimal-fff.ini` profile and writes a result manifest
under `artifacts/`. Generate fixtures first with `pnpm validation:fixtures`. Set
`PRUSASLICER_BIN` when the executable is not on `PATH`. This verifies that the files can be
loaded and sliced; it does not replace inspection in the target slicer or a physical print.

The same check is available from the manually dispatched and weekly
`.github/workflows/slicer-validation.yml` workflow. Record the exact slicer version and
profile in the manual evidence template for release decisions.

| Fixture | Template/style           | Printer/profile | Dimensions | Holes/joints/stake | Relief | Supports | Status  | Evidence |
| ------- | ------------------------ | --------------- | ---------- | ------------------ | ------ | -------- | ------- | -------- |
| ALEX    | name-keychain / contour  |                 |            |                    |        | no       | pending |          |
| ALEX    | name-keychain / capsule  |                 |            |                    |        | no       | pending |          |
| ALEX    | name-keychain / soft-tag |                 |            |                    |        | no       | pending |          |
| ALEX    | name-keychain / bubble   |                 |            |                    |        | no       | pending |          |
| ALEX    | name-keychain / arch     |                 |            |                    |        | no       | pending |          |
| ALEX    | plant-label / contour    |                 |            |                    |        | no       | pending |          |
| ALEX    | plant-label / capsule    |                 |            |                    |        | no       | pending |          |
| ALEX    | plant-label / soft-tag   |                 |            |                    |        | no       | pending |          |
| ALEX    | plant-label / bubble     |                 |            |                    |        | no       | pending |          |
| ALEX    | plant-label / arch       |                 |            |                    |        | no       | pending |          |
| ALEX    | articulated-name         |                 |            | joint motion       |        | no       | pending |          |
| ALEX    | nameplate                |                 |            |                    |        | no       | pending |          |

After the baseline set, repeat the highest-risk fixtures: a long Latin name, a long
Cyrillic name, a thin font, a heavy font, maximum nameplate tilt/embed, maximum stake
length, and tight articulated clearance. Record slicer warnings, measured dimensions,
and photos or links to evidence in the final column.

# Geometry roadmap and release gates

This document records the geometry contracts that the customizer, export pipeline, and
validation matrix share. The current release keeps the four templates and five styles;
new designs must pass the same gates before they receive a public route or SEO page.

## Baseline print profile

The release baseline is 0.4 mm PLA with no supports:

- Minimum wall: 1.2 mm unless a template-specific profile proves a lower value with a
  physical sample.
- Minimum articulated clearance: 0.35 mm.
- Recommended orientation: flat on the build plate for standard templates and plant
  labels; the articulated carrier must remain in its print plane.
- Maximum finished width: 120 mm, with an explicit warning when a user chooses a
  value that needs scaling.

The geometry result is the source of truth for these constraints. The preview uses the
same result to explain ready, adjusted, and needs-attention states; export does not
silently bypass a severity error.

## Current design identities

| Design           | Required identity                                                                  |
| ---------------- | ---------------------------------------------------------------------------------- |
| Contour          | Text-driven silhouette with a controllable outline margin.                         |
| Capsule          | True pill carrier with stable ends and balanced ring placement.                    |
| Soft tag         | Asymmetric tag/tab body structurally fused to the carrier.                         |
| Bubble           | Variable-radius organic envelope around the glyphs.                                |
| Arch             | Text and backing share a predictable curved baseline.                              |
| Articulated name | Layout-aware linked letters, captive joints, and printable necks.                  |
| Nameplate        | Deterministic tilted carrier with contained embedded relief.                       |
| Plant label      | Distinct board shoulders, reinforced stake transition, and flat-print orientation. |

## Future-template gate

A future template or style requires all of the following before implementation is
considered complete:

1. A unique silhouette and a typed parameter schema.
2. A `TemplateDefinition` or `StyleDefinition` with an explicit print profile.
3. Localized copy, accessible controls, and a preview asset.
4. Geometry tests covering supported scripts, parameter extremes, topology, and export.
5. A desktop/mobile visual capture with a non-blank model assertion.
6. A physical 0.4 mm PLA, no-support sample documented in `docs/print-validation.md`.

Candidate backlog: luggage/bag tag, desk or door plaque, fridge magnet, bookmark, and
plant-marker variants; possible style explorations include ribbon, badge, tab/fold, and
cutout. These remain backlog items until the current matrix is green.

## Validation commands

```sh
pnpm test:geometry:matrix
pnpm test
pnpm test:e2e
```

The matrix runner exercises every supported template/style combination across bundled
fonts and Latin/Cyrillic fixtures, validates STL and 3MF output, and emits a JSON
summary. Physical evidence is intentionally maintained separately from automated
tests.

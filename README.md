# Open Keychain

[![CI](https://github.com/WilfredoN/3d-keychain/actions/workflows/ci.yml/badge.svg)](https://github.com/WilfredoN/3d-keychain/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Open issues](https://img.shields.io/github/issues/WilfredoN/3d-keychain)](https://github.com/WilfredoN/3d-keychain/issues)

Open Keychain is a privacy-friendly, self-hostable browser customizer for printable name keychains. Model generation, font processing, preview, and STL/3MF export happen locally in the browser; there is no account, database, telemetry, or required backend.

## Features

- Six distinct backing recipes: Contour, Capsule, Soft Tag, Bubble, Arch, and Frame.
- Finished-geometry width fitting that keeps printable models at or below 120 mm while preserving a 12 mm minimum text height.
- Component-aware rounded bridges, preserved letter counters, manifold validation, finite-coordinate checks, and an open keyring hole.
- Adaptive curve flattening and high-quality round offsets; flat surfaces remain minimally triangulated.
- Three.js preview with exact-center rotation, six directional camera presets, a home view, bounded zoom controls, and crisp contact shadows.
- Matte, graph, and dark preview surfaces that are never included in exported files.
- STL export as one merged printable solid and 3MF export as either separate colored backing/relief objects or one merged object.
- Bundled Latin/Cyrillic fonts with script-aware compatibility checks and automatic fallback for unsupported text.
- English, Russian, and Ukrainian localization with browser detection and local preference persistence.

## Development

Requirements: Node 22+ and pnpm 10+.

```sh
pnpm install
pnpm dev
```

Quality checks:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e --workers=1
pnpm bench:geometry
pnpm bench:matrix
```

`pnpm validate` runs formatting, linting, typechecking, unit tests, and the production build. The matrix benchmark covers representative font/style/name combinations, including Cyrillic names for every bilingual family. Curved models are kept below 12,000 triangles where practical; dense meshes are reported as warnings instead of being silently degraded.

Playwright tests require browser binaries. Install them once with `pnpm exec playwright install` before running E2E locally.

## Runtime architecture

React owns controls, local preferences, and the viewer. A persistent Web Worker owns font loading, OpenType parsing, polygon operations, Manifold WASM geometry, validation, and STL/3MF serialization. Requests are coalesced and stale responses are ignored so slider movement does not freeze the interface.

```text
React controls ── latest params ──> GeometryClient ──> Web Worker
      │                                  │              │
      │                                  │              ├─ local fonts + OpenType
      │                                  │              ├─ 2D CrossSection operations
      │                                  │              ├─ Manifold WASM solids
      │                                  │              └─ STL/3MF serializers
      └──────────── MeshBuffers <────────┘
                         │
                    Three.js viewer
```

The geometry convention is millimetres, with the base on Z=0 and the model centered in X/Y. Glyph outlines are flattened with final-space curve tolerance, converted with EvenOdd winding so counters remain holes, connected into the selected backing recipe, extruded, and combined with overlapping raised text. Preview materials and surfaces are scene-only and never enter STL or 3MF.

New styles should compose the shared primitives in `src/geometry/styles.ts` and keep the existing `KeychainParams` builder boundary. Geometry remains client-side by design: there is no server, database, uploaded-font pipeline, or runtime plugin system.

## Self-hosting

The production image is a static nginx server:

```sh
docker compose up -d
```

Open <http://localhost:8080>. No environment variables or external services are required. A manual deployment can serve `dist/` from any static web server; `.wasm` and `.ttf` files need normal static-file access.

## Fonts and licensing

The project bundles fonts from Google Fonts under the SIL Open Font License. License notices are in `public/fonts/licenses/`. Bundled fonts include Nunito, Quicksand, Fredoka, Oswald, Bree Serif, Baloo 2, Kalam, Bungee, Caveat, Marck Script, Bad Script, Neucha, Amatic SC, Lobster, and Pangolin. Bilingual families include modern Cyrillic coverage; Latin-only families are disabled for Cyrillic text.

Project source is MIT licensed. Dependencies and bundled fonts retain their own licenses, which must be reviewed before redistribution.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, validation commands, geometry invariants, and conventional commit format. Security reports should follow [SECURITY.md](.github/SECURITY.md). Please use the issue templates for bug reports and feature requests.

## Browser support

Target current Chrome/Chromium, Edge, Firefox, and Safari releases with WebAssembly, Web Workers, and WebGL enabled. Model generation does not require a network connection after static assets load; restrictive content policies, private browsing, or disabled WebGL can limit local storage or preview rendering.

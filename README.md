# Open Keychain

See the [beta and product roadmap](ROADMAP.md) for upcoming templates, hosted features, and operational milestones.

[![CI](https://github.com/WilfredoN/3d-keychain/actions/workflows/ci.yml/badge.svg)](https://github.com/WilfredoN/3d-keychain/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Open issues](https://img.shields.io/github/issues/WilfredoN/3d-keychain)](https://github.com/WilfredoN/3d-keychain/issues)

Open Keychain is a privacy-friendly, self-hostable browser customizer for printable name products. Model generation, font processing, preview, and STL/3MF export happen locally in the browser. The default build has no account, database, telemetry, or required backend; an optional hosted profile adds accounts, quotas, and a saved-project gallery.

## Features

- Six distinct backing recipes: Contour, Capsule, Soft Tag, Bubble, Arch, and Frame.
- Product templates for Name keychain, Articulated name, Nameplate, and Plant label, with more templates planned.
- Finished-geometry width fitting that keeps printable models at or below 120 mm while preserving a 12 mm minimum text height.
- Component-aware rounded bridges, preserved letter counters, manifold validation, finite-coordinate checks, an open keyring hole, and a guaranteed backing inset around raised text.
- Adaptive curve flattening and high-quality round offsets; flat surfaces remain minimally triangulated.
- Three.js preview with exact-center, rotation-safe orbiting, six directional camera presets, bounded zoom controls, and crisp contact shadows.
- Matte, graph, and dark preview surfaces that follow the model without appearing in exported files.
- Wood-board and metal-board preview scenes with a rounded presentation block over a visible grid floor; these stay local and never enter exported files.
- STL export containing validated printable shells (standard templates are one solid; articulated names retain separate letter-shaped bodies and captive connectors) and 3MF export as either separate coloured structural/cap objects or one merged object.
- Bundled Latin/Cyrillic fonts with script-aware compatibility checks and automatic fallback for unsupported text.
- English, Russian, and Ukrainian localization with browser detection and local preference persistence.
- Geometric Open Keychain branding, favicon, installable manifest, and social preview assets.

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

The geometry convention is millimetres, with the base on Z=0 and the model centered in X/Y. Glyph outlines are flattened with final-space curve tolerance, converted with EvenOdd winding so counters remain holes, connected into the selected backing recipe, extruded, and combined with contained raised text. An articulated name is mechanically different: every character is a separate, glyph-shaped structural solid with a matching raised cap, local rounded joint bosses, a reinforced first-letter ring lug, and short dogbone captive connectors. Its shell count is one letter body per character plus one connector per gap; no rectangular character plates are generated. Print clearances, minimum walls, captive-head dimensions, neutral-pose separation, and the joint motion envelope are validated before export. Preview materials and surfaces are scene-only and never enter STL or 3MF.

New styles should compose the shared primitives in `src/geometry/styles.ts` and keep the existing `KeychainParams` builder boundary. Geometry remains client-side by design: hosted mode never uploads fonts or meshes. Its small TypeScript API only manages sessions, quotas, and versioned projects.

## Self-hosting

The production image is a static nginx server:

```sh
docker compose up -d
```

Open <http://localhost:8080>. No environment variables or external services are required. A manual deployment can serve `dist/` from any static web server; `.wasm` and `.ttf` files need normal static-file access.

For the Hetzner beta host, copy `.env.hosted.example` to `.env`, set long random database and auth secrets, then run:

```sh
docker compose -f docker-compose.hosted.yml up -d --build
```

The hosted profile serves the frontend and API behind one origin and keeps PostgreSQL private. Anonymous users receive three successful exports per rolling week by default; tune this to one or two with `ANONYMOUS_WEEKLY_EXPORTS`. Paid-plan limits are configuration values with separate per-minute and per-day safety caps. Configure off-host encrypted backups and test restores before opening registration publicly.

The hosted account gallery stores versioned keychain parameters, not generated meshes. Projects are loaded back into the browser and regenerated locally.

Payment processing is intentionally not enabled yet. The API includes plan/subscription storage and a provider-neutral billing contract so a processor or merchant-of-record can be added after pricing, tax, and regional requirements are confirmed.

## Fonts and licensing

The project bundles fonts from Google Fonts under the SIL Open Font License. License notices are in `public/fonts/licenses/`. Bundled fonts include Nunito, Quicksand, Fredoka, Oswald, Bree Serif, Baloo 2, Kalam, Bungee, Rubik Black, Montserrat Black, Caveat, Marck Script, Bad Script, Neucha, Amatic SC, Lobster, and Pangolin. Bilingual families include modern Cyrillic coverage; Latin-only families are hidden when the entered text needs Cyrillic glyphs. Articulated names offer the mechanically verified heavy families only (Bungee, Rubik Black, and Montserrat Black); choosing the template automatically selects a compatible option when necessary.

Project source is MIT licensed. This permits self-hosting, commercial use, and operating a paid hosted Open Keychain service. MIT also permits others to host modified versions, so this repository does not claim exclusivity over hosted forks. Dependencies and bundled fonts retain their own licenses, which must be reviewed before redistribution.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, validation commands, geometry invariants, and conventional commit format. Security reports should follow [SECURITY.md](.github/SECURITY.md). Please use the issue templates for bug reports and feature requests.

## Browser support

Target current Chrome/Chromium, Edge, Firefox, and Safari releases with WebAssembly, Web Workers, and WebGL enabled. Model generation does not require a network connection after static assets load; restrictive content policies, private browsing, or disabled WebGL can limit local storage or preview rendering.

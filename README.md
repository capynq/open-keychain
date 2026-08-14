# Open Keychain

Open Keychain is a local-first browser customizer for home-based 3D-printing businesses and makers. A seller can receive a customer name, customize a printable product, preview it, export STL or 3MF, print it locally, and sell the finished item.

The default build runs without an account, database, telemetry, or required backend. An optional hosted profile adds experimental accounts, export quotas, and saved project parameters. See the [product strategy](docs/product-strategy.md) and [beta and product roadmap](ROADMAP.md) for the intended commercial workflow and readiness gates.

> Current status: the local generation and export workflow is in technical-alpha preparation. Hosted accounts and quotas are experimental, billing is disabled, and broad physical print verification is still a launch gate.

[![CI](https://github.com/WilfredoN/open-keychain/actions/workflows/ci.yml/badge.svg)](https://github.com/WilfredoN/open-keychain/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Open issues](https://img.shields.io/github/issues/WilfredoN/open-keychain)](https://github.com/WilfredoN/open-keychain/issues)

## Core workflow

1. Enter a customer name.
2. Choose a product template, font, and supported shape options.
3. Review the Three.js preview and printable validation messages.
4. Export STL for broad slicer compatibility or 3MF for separate or merged color-aware objects.
5. Slice, print, inspect, and sell locally.

For occasional hobby projects, the no-account local workflow is enough. Repeat sellers need saved projects, customer references, batch export, reusable presets, and order-oriented tools; those are tracked in the [commercial workflow roadmap](ROADMAP.md#commercial-workflow-roadmap).

## Current capabilities

- Five backing recipes: Contour, Capsule, Soft Tag, Bubble, and Arch.
- Product templates for Name keychain, Articulated name, Nameplate, and Plant label.
- Finished-geometry width fitting that keeps printable models at or below 120 mm while preserving a 12 mm minimum text height.
- Component-aware rounded bridges, preserved letter counters, manifold validation, finite-coordinate checks, an open keyring hole, and a guaranteed backing inset around raised text.
- Adaptive curve flattening and high-quality round offsets; flat surfaces remain minimally triangulated.
- Three.js preview with exact-center, rotation-safe orbiting, six directional camera presets, bounded zoom controls, and crisp contact shadows.
- Matte, graph, and dark preview surfaces that follow the model without appearing in exported files.
- Wood-board and metal-board preview scenes with a rounded presentation block over a visible grid floor; these stay local and never enter exported files.
- STL export containing validated printable shells. Standard templates are one solid; articulated names retain separate letter-shaped bodies and captive connectors.
- 3MF export as separate coloured structural/cap objects or one merged object.
- Bundled Latin/Cyrillic fonts with script-aware compatibility checks and automatic fallback for unsupported text.
- English, Russian, and Ukrainian localization with browser detection.
- Geometric Open Keychain branding, favicon, installable manifest, and social preview assets.

Software validation is not the same as a physically print-verified result. The required font/template/nozzle/printer matrix and slicer checks are documented in the [roadmap](ROADMAP.md#geometry-and-print-quality-validation) and [launch checklist](docs/launch-checklist.md).

## Development

Requirements: Node 22.22.1+ and pnpm 10+.

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

Git hooks are installed by `pnpm install`. The pre-commit hook formats and lints staged files, the commit-msg hook checks conventional commits, and the pre-push hook runs `pnpm validate`. Continuous integration additionally runs the geometry matrix and browser tests. Use `git commit --no-verify` only for an exceptional recovery case, then run the skipped checks manually.

## Runtime architecture

React owns controls, live parameter state, and the viewer. A persistent Web Worker owns font loading, OpenType parsing, polygon operations, Manifold WASM geometry, validation, and STL/3MF serialization. Requests are coalesced and stale responses are ignored so slider movement does not freeze the interface.

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

The source tree follows feature-first composition with explicit domain and infrastructure boundaries:

```text
src/
├── app/                         composition root, shell components, and app-level styles
├── domain/keychain/             printable model domain
│   ├── model/                   params, dimensions, mesh/result types
│   ├── text/                    font outline and glyph processing
│   ├── fonts/                   font catalog and support detection
│   ├── styles/                  style geometry definitions
│   ├── templates/               template geometry definitions
│   └── build/                   model assembly and validation
├── features/
│   ├── customizer/              controls, parameter state, and generation lifecycle
│   ├── preview/                 viewer, camera poses, and preview styling
│   ├── export/                  export dialog and download orchestration
│   └── hosted/                  account, project, quota, and billing API client
├── infrastructure/
│   ├── geometry/                Manifold/WASM worker and geometry adapters
│   ├── export/                  STL and 3MF serializers
│   └── i18n/                    i18next setup, locale utilities, and JSON locales
└── main.tsx                     browser entrypoint
```

New styles should compose the shared primitives in `src/domain/keychain/styles/style-builder.ts` and keep the existing `KeychainParams` builder boundary. Geometry remains client-side by design: hosted mode does not need to upload fonts or generated meshes. Its small TypeScript API manages sessions, quotas, and parameter projects.

Keep new code in the narrowest matching package. The domain package must stay independent of React and browser state; feature packages own UI workflows; infrastructure packages own browser, worker, WASM, network, and file-format integrations. Each package exposes a small `index.ts` barrel for consumers so imports do not depend on implementation filenames.

## Deployment modes

The two deployment modes serve different needs:

| Mode           | Accounts                             | Data sent to a server                                                          | Best for                                        | Current status                 |
| -------------- | ------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------ |
| Local/static   | None required                        | None for generation/export                                                     | Hobby use, privacy, self-hosting                | Available                      |
| Hosted profile | Email/password account, experimental | Sessions, quota events, project parameters, and any accepted thumbnail payload | Repeat sellers who need projects across devices | Experimental; billing disabled |

### Self-hosted local build

The production image is a static nginx server:

```sh
docker compose up -d
```

Open <http://localhost:8080>. No environment variables or external services are required. A manual deployment can serve `dist/` from any static web server; `.wasm` and `.ttf` files need normal static-file access. See the [self-hosting guide](docs/self-hosting.md) for upgrades, rollbacks, asset handling, and operator responsibilities.

### Optional hosted profile

For the experimental hosted stack, copy `.env.hosted.example` to `.env`, set long random database and auth secrets, then run:

```sh
docker compose -f docker-compose.hosted.yml up -d --build
```

The hosted profile serves the frontend and API behind one origin and keeps PostgreSQL private. Anonymous users receive three successful exports per rolling week by default; tune this with `ANONYMOUS_WEEKLY_EXPORTS`. The current implementation also has paid-plan safety-limit seams, but no payment provider or paid checkout is enabled. Hosted projects store parameter snapshots and a schema version, not generated meshes; version history is planned. See the [hosted-service guide](docs/hosted-service.md).

## Fonts and licensing

The project bundles fonts from Google Fonts under the SIL Open Font License. License notices are in `public/fonts/licenses/`. The current catalog includes Nunito, Quicksand, Fredoka, Oswald, Bree Serif, Baloo 2, Kalam, Bungee, Rubik Black, Montserrat Black, Caveat, Marck Script, Bad Script, Neucha, Amatic SC, Lobster, Pangolin, Playpen Sans, Shantell Sans, Balsamiq Sans, Comforter, Comforter Brush, and Underdog. Bilingual families include modern Cyrillic coverage; Latin-only families are hidden when the entered text needs Cyrillic glyphs. Articulated names offer the mechanically verified heavy families only (Bungee, Rubik Black, and Montserrat Black); choosing the template automatically selects a compatible option when necessary.

Project source is MIT licensed. This permits self-hosting, commercial use, and operating a paid hosted Open Keychain service. MIT also permits others to host modified versions, so this repository does not claim exclusivity over hosted forks. Dependencies and bundled fonts retain their own licenses, which must be reviewed before redistribution. See the [licensing guide](docs/licensing.md) for practical implications.

## Documentation

- [Product strategy](docs/product-strategy.md) — target users, workflow, assumptions, and commercial value.
- [Roadmap](ROADMAP.md) — readiness gates, validation, hosted milestones, and commercial priorities.
- [Hosted service](docs/hosted-service.md) — hosted architecture, security, operations, billing, and privacy gaps.
- [Self-hosting](docs/self-hosting.md) — Docker, static deployment, assets, upgrades, backups, and operator security.
- [Launch checklist](docs/launch-checklist.md) — release sign-off and distribution sequence.
- [Market validation](docs/market-validation.md) — maker interviews, pilot design, and evidence to collect.
- [Licensing](docs/licensing.md) — MIT, fonts, dependencies, forks, and commercial service implications.
- [CONTRIBUTING.md](CONTRIBUTING.md) — development workflow and validation commands.
- [SUPPORT.md](SUPPORT.md) — help channels and issue reproduction details.
- [GOVERNANCE.md](GOVERNANCE.md) — project decisions and maintainer responsibilities.
- [SECURITY.md](.github/SECURITY.md) — vulnerability reporting.

## Browser support

Target current Chrome/Chromium, Edge, Firefox, and Safari releases with WebAssembly, Web Workers, and WebGL enabled. Model generation does not require a network connection after static assets load. Restrictive content policies, disabled WebGL, or blocked font/WASM assets can limit generation or preview rendering.

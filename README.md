# Open Keychain

Open Keychain is a privacy-friendly, self-hostable browser customizer for printable name keychains. Model generation, font processing, preview, and STL/3MF export happen locally in the browser; there is no account, database, telemetry, or required backend.

## Development

Requirements: Node 22+ and pnpm 10+.

```sh
pnpm install
pnpm dev
```

Quality checks:

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm bench:geometry
pnpm bench:matrix
```

The matrix benchmark covers the representative font/style/name combinations, including Cyrillic names for every bilingual family. The current Node-side benchmark generates typical models in about 12–100 ms with roughly 500–10,600 finished triangles; long names are automatically scaled below 120 mm. Browser timing should still be checked on target low-power devices because WASM and worker startup vary by browser.

Playwright tests are included with `pnpm test:e2e`. Install the required browser binaries once with `pnpm exec playwright install` when running E2E locally or in CI.

## Self-hosting

The production image is a static nginx server:

```sh
docker compose up -d
```

Open <http://localhost:8080>. No environment variables or external services are required. A manual deployment can serve the contents of `dist/` from any static web server; make sure `.wasm` and `.ttf` files are served with normal static-file access.

## Architecture

React and Three.js run the interface and preview. A reusable Web Worker owns OpenType parsing, polygon operations, Manifold WASM geometry, and STL/3MF serialization. The UI keeps only the latest requested generation and retains the last valid preview when a new request fails. Preview surfaces and lighting are scene-only and are never exported.

The geometry convention is millimetres, with the base on Z=0 and the model centered in X/Y. Text contours are flattened from bundled OFL/MIT-compatible font files, converted with EvenOdd winding, offset into a connected backing, extruded, and combined with a small overlapping relief. Manifold provides robust 2D operations and manifold solids.

See [ARCHITECTURE.md](ARCHITECTURE.md) for module boundaries, constraints, and decisions.

## Fonts and licensing

The project bundles fonts from the Google Fonts repository under the SIL Open Font License. License notices are in `public/fonts/licenses/`. The application code uses MIT/Apache-2.0 dependencies; dependency licenses should be reviewed again before a release.

Bundled fonts: Nunito, Quicksand, Fredoka, Oswald, Bree Serif, Baloo 2, Kalam, Bungee, Caveat, Marck Script, Bad Script, Neucha, Amatic SC, Lobster, and Pangolin. Bilingual families include modern Cyrillic coverage; Latin-only families are disabled for Cyrillic text.

The preview supports matte, graph, and dark studio surfaces, bounded zoom buttons, and sharp contact shadows. STL remains a merged printable solid. 3MF can export either separate colored backing/relief objects or one merged object; the preview surface is excluded from both formats.

## Browser support

Target current Chrome/Chromium, Edge, Firefox, and Safari releases with WebAssembly, Web Workers, and WebGL enabled. Private browsing modes or restrictive content policies may prevent local storage or WebGL, but model generation does not require a network connection after the static assets load.

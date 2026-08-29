# Open Keychain

[![CI](https://github.com/capynq/open-keychain/actions/workflows/ci.yml/badge.svg)](https://github.com/capynq/open-keychain/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE) [![Live site](https://img.shields.io/badge/live-open--keychain.com-ef6c45)](https://open-keychain.com/)

Open Keychain is an open-source, local-first tool for designing personalized 3D-printable keychains and labels. Enter a name, choose a template, preview the model, then export STL or 3MF for your own slicer and printer.

Try the live [Open Keychain 3D printable keychain maker](https://open-keychain.com/), browse the [template hub](https://open-keychain.com/templates/), or read the [3D printing guides](https://open-keychain.com/guides/).

> Beta note: generated files still need checking in your slicer and testing on your printer. Filament, machine calibration, orientation, and slicer settings affect the physical result.

![Open Keychain customizer on desktop](public/showcase/create-desktop.png)

<p align="center">
  <img src="public/showcase/create-mobile.png" alt="Open Keychain customizer on mobile" width="260" />
</p>

## Highlights

- Generate name keychains, articulated names, nameplates, and plant labels from one short text input.
- Preview validated geometry in the browser and export STL or 3MF for your slicer.
- Use the [name keychain](https://open-keychain.com/templates/name-keychain/), [articulated name](https://open-keychain.com/templates/articulated-name/), [nameplate](https://open-keychain.com/templates/nameplate/), or [plant label](https://open-keychain.com/templates/plant-label/) templates.
- Keep names, local fonts, geometry generation, and exported files on-device in the default local-first workflow.

## Use it locally

The browser version is free to use and does not require an account. Fonts, geometry generation, preview, and exports run in the browser in the default build.
The supported baseline is a modern browser with WebGL and WebAssembly. If WebGL is unavailable or
lost, editing and validated export remain available while the interactive preview is replaced with
an accessible message.

```sh
pnpm install
pnpm dev
```

Open the local address printed by Vite, then visit `/create` to start designing.

For browser checks, `pnpm test:e2e:smoke` runs the fast six-check smoke suite on desktop and mobile. The full matrix is `pnpm test:e2e` and is reserved for release validation.

The supported development toolchain is Node 22+ with pnpm 10. TypeScript checks use the native
TypeScript 7 compiler; the repository may retain a private TypeScript 6 compatibility alias until
the lint parser fully supports TypeScript 7. `pnpm build:artifact` reuses an already-passed
typecheck when CI or browser checks need to consume the production artifact.

### Optional Google Fonts

The included catalog works offline. To enable the opt-in Google Fonts browser, set
`VITE_GOOGLE_FONTS_API_KEY` before starting Vite or building the app. This browser-visible key
is public by design; restrict it in Google Cloud by HTTP referrer to your production domain and
local development origins. The app requests only Google family metadata and selected font files,
never the entered name or preview text. If the key is missing or requests are blocked, the
customizer keeps using the included fonts.
Local TTF/OTF fonts are session-local and may require permission again after reconnecting a file.
Shared links never embed font bytes: Google and local fonts are replaced with a bundled fallback and
the recipient is warned so the appearance change is explicit.

## Self-host it

### Docker

```sh
docker compose up -d --build
```

Open <http://localhost:8080>. The image builds the app and serves it with nginx; no database or environment variables are required for the default local workflow.

### Static hosting

```sh
pnpm install
pnpm build
```

Serve `dist/` from any static host. Configure an SPA fallback to `index.html` for `/` and `/create`, and allow normal static access to `/manifold.wasm`, `/fonts/`, `/showcase/`, and hashed `/assets/` files. [`nginx.conf`](nginx.conf) is a working reference.

The generated SEO pages are self-contained HTML and include a small, consent-gated analytics
bundle. It sends only page type, page ID, locale, and CTA metadata after a visitor opts in;
names, query strings, and exported files are never included. Set `VITE_POSTHOG_KEY` (and
optionally `VITE_POSTHOG_HOST`) at build time to enable it. See [`docs/analytics.md`](docs/analytics.md).

For the optional hosted profile, use [`docs/hosting-readiness.md`](docs/hosting-readiness.md) for domain, HTTPS, secrets, backup, and private-pilot gates. Billing is not enabled.

## What you can make

- Name keychains with a keyring hole and raised lettering
- Articulated names with linked letters
- Nameplates for desks, drawers, or shelves
- Plant labels with a pointed stake

The customizer exports printable STL and 3MF files. Review the downloaded model in your slicer before printing; Open Keychain does not claim physical-print verification for every printer or material.

## Privacy and future hosting

The default local and self-hosted workflows keep generation and export on the device running the browser. The optional SEO analytics is consent-gated and sends only coarse page metadata; it never sends names, search strings, generated geometry, or exported files. This repository contains no active payment flow, price list, or hosted workspace offering. A future hosted workspace is only a concept for saved projects, seller presets, and repeat-order/batch tools.

## Development

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm bench:matrix
pnpm test:e2e:smoke
```

For the shortest feedback loop, use `pnpm test:fast` for focused unit checks and
`pnpm test:e2e:smoke` for browser changes. The complete unit suite remains `pnpm test`; the full
201-test browser matrix is a release gate. Set `PUSH_E2E_MODE=full` when an explicit full browser
run is required from the pre-push hook, and use `PUSH_E2E_WORKERS` to tune its worker count.
Use `pnpm test:e2e:performance` for the dedicated six-case preview performance regression suite.

Bun is an experimental shadow runtime for local tooling only. It does not replace Node in Docker,
CI, the geometry matrix, slicer validation, or release workflows. The geometry matrix is automated
printability evidence and is not a claim of physical-printer validation.

Install Chromium for the browser checks once with `pnpm exec playwright install chromium`. Use `pnpm capture:ui` when the reviewed customizer screenshots need to be refreshed; it is an explicit capture command and does not run in ordinary CI.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and pull-request guidance. Report vulnerabilities through the [security policy](.github/SECURITY.md).

## License and bundled fonts

Open Keychain is released under the [MIT License](LICENSE). Bundled fonts retain their own licenses; their notices are kept in [`public/fonts/licenses/`](public/fonts/licenses/).

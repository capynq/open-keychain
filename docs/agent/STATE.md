# Agent handoff

## Repository state

- **Branch:** `main`
- **HEAD:** Latest PageSpeed optimization commit (`perf(landing): optimize mobile PageSpeed findings`)
- **Working tree:** Clean; the follow-up PageSpeed optimization is committed and ready for deployment.

## Current objective

Remediate the supplied PageSpeed SEO, accessibility, and landing-performance findings without changing public routes, PNG/social-image compatibility, or carousel behavior.

## Completed in the working tree

- Added `/ai-catalog.json`, removed the unsupported `LLMs:` robots directive, and retained `/llms.txt` discovery through HTML and HTTP `describedby` links.
- Added catalog, font, versioned showcase, and versioned Manifold WASM headers; the geometry loader now uses `/manifold-v1.wasm` while the legacy file remains available.
- Moved the carousel landmark to a named section, kept native figure semantics, and added localized slide group labels.
- Lazy-loaded landing CSS away from customizer/profile routes, avoided redundant at-top navigation scrolling, added below-fold containment, and added AVIF/WebP picture sources with legacy PNG fallbacks.
- Added the reproducible `pnpm assets:landing` Sharp generator and checked in `showcase/v1` derivatives.
- Added a 490px mobile hero derivative, density-specific mobile `<picture>` sources, and a root-only hero preload.
- Corrected Netlify header precedence so versioned showcase assets receive immutable one-year caching.
- Improved run-card text contrast and footer link target sizing; expanded responsive image, contrast, and deployment assertions.

## Validation actually run

- `pnpm validate` passed: formatting, lint, type-checking, 41 unit files / 504 tests, and production build.
- `pnpm validate:changed -- …` passed for the changed source/static files.
- Carousel and route Playwright coverage passed across desktop, mobile, and mobile-2x (78 tests).
- Deployment/static-resource coverage passed across all three projects (12 tests); smoke coverage passed (9 tests); gated performance coverage passed (9 tests).
- A local Chromium trace of the landing load recorded 1,222 events, including 10 `Layout` and 12 `UpdateLayoutTree` events. These residual browser/framework events were not used to justify speculative carousel changes.
- Follow-up validation: `pnpm validate` passed (41 files / 504 tests and production build); focused desktop/mobile/mobile-2x route, performance, and contrast coverage passed 80 tests with one intentional desktop touch-target skip.

## Exact next action

After hosting deploys the latest commit, run the deployment/static-resource checks against the updated site and rerun PageSpeed for desktop and mobile.

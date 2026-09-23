# Agent handoff

## Repository state

- **Branch/HEAD:** `main` at `8900710`; no commit, staging, or push was authorized.
- **Working tree:** Customizer first-paint and boot-recovery work remains uncommitted. Preserve all existing changes.

## Current objective and result

Replace the indefinite generic loading shell with useful first-paint content and a recoverable failure state. The production build emits a route-specific `/create` document with 18 same-source Customizer frames (six initial states across en/ru/uk), while the shared landing document remains free of those frames. The boot frame is inert until React commits; route and lazy-chunk failures release it. An entry/runtime failure or a 12-second stall shows a localized reload action, with a separate no-JavaScript message.

Development `/create` and `/create/` also receive the selected frame. The dev-only SSR render is serialized and uses a separate Vite cache. Explicit pre-React CSS links include the lazy Viewer's appearance-control stylesheet; this removed the measured 10px mobile controls-panel shift. Dev-only Playwright tests are excluded from the production Playwright config. The server uses `strictPort` to avoid silently moving from 5173 to 5174.

The earlier first-paint work also added route-preload and retryable lazy-chunk behavior, stable transitions from landing/profile to the Customizer, and focused browser coverage for these paths. The mismatched generic Customizer skeleton CSS was removed.

## Validation actually run

- `pnpm validate:changed` passed.
- `pnpm validate` passed (format, lint, typecheck, 41 Vitest files / 504 tests, production build). Vite still reports the existing `manifold-3d` `node:module` browser-externalization warning.
- Focused production Playwright recovery and route-handoff matrix: 34 passed, 2 expected desktop-only skips across desktop, mobile, and mobile-2x.
- Isolated dev-boot Playwright suite: 6 passed across desktop and mobile, including held-entry box parity and concurrent cold/repeat requests. The focused suite also passed twice before the final TypeScript-only test-helper correction.
- Existing local port 5173 returned HTTP 200 for `/create?template=magnet`. A new server start correctly failed because that port was already occupied; the running server was left untouched.
- `git diff --check` passed after the handoff edit.

## Known unrelated issue

An earlier hosted workspace browser run found a stale `Order CSV` assertion expecting `order_id,text,quantity\n`; the current UI defaults to `order_id,text,quantity,subtitle\n`. This task did not change that assertion.

## Exact next action

Review the complete uncommitted first-paint diff and, if desired, run the broader browser matrix before requesting commit authorization. Do not commit or push without explicit current-conversation approval.

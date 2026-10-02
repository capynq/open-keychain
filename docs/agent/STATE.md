# Agent handoff

## Repository state

- **Branch:** `main`; implementation commits through `bf446ef` are ready to push.
- Three commits cover geometry worker recovery, the public/private product boundary, and PostHog's
  first-party proxy. The handoff update is the only remaining local change.

## Work completed

- Geometry preview, validation, and export requests now have a 30-second deadline. Worker failures
  reject pending work, terminate the failed worker, and allow one replacement-worker recovery attempt.
- Public product docs keep the MIT/local-first client separate from private hosted-service operations.
- Consent-gated PostHog uses `https://cabinet.open-keychain.com` by default and the provided
  `2026-05-30` SDK defaults. GitHub builds read the key from `VITE_POSTHOG_KEY` repository secret
  and optional host override from `VITE_POSTHOG_HOST` repository variable. Netlify site environment
  variables do not reach this GitHub-built artifact.

## Validation

- `pnpm validate` passed: format, lint, typecheck, 39 test files / 505 tests, and production build.
- After the final host fallback edit, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, and
  `git diff --check` passed.

## Next action

Push `main`; its CI workflow builds and deploys the production artifact to Netlify. To enable PostHog
in that artifact, configure the project key as a GitHub Actions repository secret. The configured
Netlify host value alone is not read by this deployment workflow.

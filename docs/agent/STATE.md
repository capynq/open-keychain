# Agent handoff

## Current work

- Added consent-gated Customizer signals for setup-step views, completions, and exits, plus coarse option changes using fixed step IDs and catalog-backed option IDs. The event sanitizer rejects names, dimensions, slider values, colors, and other unapproved properties.
- Added a bounded queue for events while PostHog initializes. Consent is rechecked before initialization and when the SDK becomes ready; declining clears pending events and opts out. The SDK explicitly disables performance, campaign/referrer persistence, and client-side console-log capture, alongside existing autocapture, pageview, pageleave, dead-click, cookie, and session-recording settings. `before_send` strips URL query/hash, campaign/search attribution, referrers, and unneeded SDK metadata from event properties and person-property containers.
- Updated analytics consent copy and privacy documentation to describe pseudonymous activity. The existing rating-and-reason widget remains the only prompt.
- The activation funnel is an ordered, 14-day unique-person funnel. For 2026-09-07 through 2026-10-07, event totals were 7 `landing_view` events from 4 people/sessions and 3 `start_designing` events from 3 people/sessions. One person/session had both events, but `start_designing` came first; there were no landing-to-start conversions. Trend event totals and funnel progression are different measures, so the zero conversion is consistent with the event sequence.
- Survey `01a112ce-d450-0000-ef5b-f8987da5d5ea` remains live and had 0 shown, dismissed, or sent events at the latest check on 2026-10-07. Keep its results tile deferred until responses exist.

## Validation

- Passed before the privacy re-review: `pnpm validate:changed` for all touched files, `pnpm typecheck`, `pnpm build`, focused telemetry/setup tests (10/10), route consent/CTA E2E (9/9 across desktop, mobile, and mobile-2x), quick-setup flow E2E (3/3 across those viewports), and `git diff --check`. After remediation, telemetry tests passed (9/9), `pnpm validate:changed`, `pnpm typecheck`, `pnpm build`, and `git diff --check` passed again. The separated reviewer confirms the campaign/referrer finding is resolved and reports no new code regression.
- Build completed with the existing Vite warning that `manifold-3d` externalizes `node:module` for browser compatibility.
- Known unrelated failure in untouched `src/features/customizer/hooks/useQuickSetup.test.ts`: `does not commit a setup superseded by a different accepted model` expects `setupError` to be true but receives false. Not investigated in this task.

## Repository state and next action

- Branch `main`, HEAD `271f706`, aligned with `origin/main`. Task changes are uncommitted; no commit, push, or deploy was made.
- A live `project-get` on 2026-10-07 confirmed project `251074` still has `capture_console_log_opt_in: true` and `logs_settings.capture_console_logs: true`. The connected PostHog tools expose no project-settings write operation, and no browser is available in this session; the external setting remains unresolved. PostHog documents that project-level console logging can independently enable capture despite the local `logs.captureConsoleLogs: false` setting.
- No commit or push was made. Next: disable project-level console-log capture for project `251074` and verify it is off; then re-review/validate and obtain commit authorization before pushing. After action events accrue, compare event trends with the ordered funnel again; add the survey results tile only after responses exist.

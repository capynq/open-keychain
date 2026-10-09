# Analytics and error monitoring

Open Keychain keeps the editor local-first. Product analytics and error monitoring are optional integrations and are disabled until a visitor explicitly accepts analytics in the consent banner.

## Static-host environment variables

Set these in the Netlify production environment. The GitHub Actions workflows run `netlify build`
with the production context before deploying, so the build reads the same site settings. For local
builds, set them in your environment or `.env` file:

- `VITE_POSTHOG_KEY`: the project key from a PostHog project. Events use the first-party reverse proxy at `https://cabinet.open-keychain.com` by default. Set `VITE_POSTHOG_HOST` only when overriding that proxy host.

Never commit the project key to the repository. After changing either setting, trigger a new build
and deploy because `VITE_*` values are embedded in the bundle.

## What is collected

The app sends pseudonymous, coarse product events only after consent: page/landing views, language changes, template selection, generation success/failure, export start/completion/failure, surface preset changes, and the primary call-to-action. In the Customizer, setup-step views/completions/abandonment use fixed step IDs. Option changes use only bundled font IDs, font category IDs, keyring position/opening preset IDs, and base/text finish profile IDs. Names, exact dimensions, slider values, colors, query strings, generated geometry, and exported files are not sent.

The app owns page-view events: landing routes emit `landing_view`; other routes emit `page_view`. PostHog automatic page capture stays disabled, so SPA navigation does not create a second page-view event. Customizer entry, geometry completion/failure, and export start/completion/failure include random short-lived attempt/design IDs, bounded durations, fixed outcomes, and allowlisted error codes. A completed export means the file was created and the browser download was invoked, not that it was written to disk.

Every app-generated event passed through `track` includes a fixed `environment` value (`development`, `preview`, or `production`) and an `internal_traffic` boolean. Development and preview are marked internal automatically. For a production QA browser, set `localStorage.setItem('open-keychain.internal-traffic', 'true')` before the next event; remove that key to reset it. This marker is local to that browser and is not based on email, identity, or design content. The build includes a Git SHA as `app_version` when CI supplies `GITHUB_SHA`.

SEO pages and indexable customizer entry points are rendered by the same React application and emit
`seo_page_view`, `seo_cta_clicked`, and `seo_language_changed` after consent. Customizer entry points
use `page_type: app`; `page_id` is the stable template ID or `create`. Their complete property allowlist is
`page_type`, `page_id`, `locale`, `cta`, `from`, and `to`; page-view events also use a sanitized route
identifier. Names, raw query strings, geometry, and exported files are never included.

PostHog autocapture, page capture, page-leave capture, web-vitals/performance capture, client-side console-log capture, campaign/referrer persistence, cookies, and session replay are disabled in the client configuration. The live project settings inspected on 2026-10-08 still enable project-level console-log, performance, and session-recording capture; keep session recording disabled in the client and do not describe the project as privacy-aligned until these project settings are switched off and independently rechecked. A `before_send` scrub keeps URL routes while removing query strings and fragments, and strips campaign/search attribution, referrers, raw user agents, viewport dimensions, and any GeoIP properties from event and person-property payloads. Server-side IP enrichment remains controlled by the PostHog project. The activity remains pseudonymous PostHog activity; disabling session recording does not make event activity fully anonymous.

## Customizer feedback survey

The Customizer feedback widget is configured in PostHog project `251074` and targets the `/create`
route. It asks for a required 1–5 usefulness rating and an optional single-choice reason. It has no
free-text question, and the survey does not request names, design parameters, or generated geometry.
The existing consent-gated SDK loads only after analytics is accepted; PostHog keeps surveys hidden
while capture is disabled and after opt-out. The rating-and-reason widget is the only direct prompt;
do not add another prompt until this one has impressions and the action data identifies a specific
friction point.

Verify the survey's live status, targeting, impression count, and response flow in PostHog before
reporting it as operational. The last checked dashboard does not yet contain a Survey Results
widget; add one to **Open Keychain Activation** after its status and consent-gated browser delivery
have been verified. On 2026-10-08 it was active with zero impressions, dismissals, or responses.
Its generated internal-targeting flag was inactive and did not resolve as a project feature flag;
do not enable or replace it until its intended targeting is identified. The survey is currently
English-only (`translations` is unset).

Visitors can decline analytics and can review the policy at `/privacy`.

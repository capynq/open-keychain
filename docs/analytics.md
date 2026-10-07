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

SEO pages and indexable customizer entry points are rendered by the same React application and emit
`seo_page_view`, `seo_cta_clicked`, and `seo_language_changed` after consent. Customizer entry points
use `page_type: app`; `page_id` is the stable template ID or `create`. Their complete property allowlist is
`page_type`, `page_id`, `locale`, `cta`, `from`, and `to`; page-view events also use a sanitized route
identifier. Names, raw query strings, geometry, and exported files are never included.

PostHog autocapture, page capture, page-leave capture, web-vitals/performance capture, client-side console-log capture, campaign/referrer persistence, cookies, and session replay are explicitly disabled in the client configuration. The PostHog project's console-log setting is independent and can enable capture on its own; a live project check on 2026-10-07 confirmed it remains enabled, so it must be switched off before treating logs as disabled. A `before_send` scrub keeps URL routes while removing query strings and fragments, and strips campaign/search attribution, referrers, raw user agents, viewport dimensions, and any GeoIP properties from event and person-property payloads. Server-side IP enrichment remains controlled by the PostHog project. The activity remains pseudonymous PostHog activity; disabling session recording does not make event activity fully anonymous.

## Customizer feedback survey

The Customizer feedback widget is configured in PostHog project `251074` and targets the `/create`
route. It asks for a required 1–5 usefulness rating and an optional single-choice reason. It has no
free-text question, and the survey does not request names, design parameters, or generated geometry.
The existing consent-gated SDK loads only after analytics is accepted; PostHog keeps surveys hidden
while capture is disabled and after opt-out. The rating-and-reason widget is the only direct prompt;
do not add another prompt until this one has impressions and the action data identifies a specific
friction point.

The survey is live. PostHog's survey page provides its response results. Add a Survey Results widget
to the existing **Open Keychain Activation** dashboard when dashboard widget creation is available
through the connected PostHog interface.

Visitors can decline analytics and can review the policy at `/privacy`.

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

The app sends only coarse, anonymous product events after consent: page/landing views, language changes, template selection, generation success/failure, export start/completion/failure, surface preset changes, and the primary call-to-action. Event properties contain stable IDs, locale, export format/mode, and status categories. Names, query strings, generated geometry, and exported files are not sent.

SEO pages and indexable customizer entry points are rendered by the same React application and emit
`seo_page_view`, `seo_cta_clicked`, and `seo_language_changed` after consent. Customizer entry points
use `page_type: app`; `page_id` is the stable template ID or `create`. Their complete property allowlist is
`page_type`, `page_id`, `locale`, `cta`, `from`, and `to`; page-view events also use a sanitized route
identifier. Names, raw query strings, geometry, and exported files are never included.

PostHog autocapture, page capture, page-leave capture, cookies, and session replay are disabled.

## Customizer feedback survey

The Customizer feedback widget is configured in PostHog project `251074` and targets the `/create`
route. It asks for a required 1–5 usefulness rating and an optional single-choice reason. It has no
free-text question, and the survey does not request names, design parameters, or generated geometry.
The existing consent-gated SDK loads only after analytics is accepted; PostHog keeps surveys hidden
while capture is disabled and after opt-out. Autocapture and session recording remain disabled.

The survey is live. PostHog's survey page provides its response results. Add a Survey Results widget
to the existing **Open Keychain Activation** dashboard when dashboard widget creation is available
through the connected PostHog interface.

Visitors can decline analytics and can review the policy at `/privacy`.

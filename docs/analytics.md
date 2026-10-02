# Analytics and error monitoring

Open Keychain keeps the editor local-first. Product analytics and error monitoring are optional integrations and are disabled until a visitor explicitly accepts analytics in the consent banner.

## Static-host environment variables

For local builds, set these in your environment or `.env` file. Production bundles are built in
GitHub Actions before Netlify deploys the artifact, so set `VITE_POSTHOG_KEY` as a GitHub Actions
repository secret and `VITE_POSTHOG_HOST` as a repository variable:

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

Visitors can decline analytics and can review the policy at `/privacy`.

# Analytics and error monitoring

Open Keychain keeps the editor local-first. Product analytics and error monitoring are optional integrations and are disabled until a visitor explicitly accepts analytics in the consent banner.

## Netlify environment variables

Set these variables in the production deploy context before redeploying:

- `VITE_POSTHOG_KEY`: the project key from a PostHog project. The default host is the PostHog EU endpoint; set `VITE_POSTHOG_HOST` only when using another PostHog region or a self-hosted endpoint.

Never commit any of these values to the repository. After changing them, trigger a new Netlify deploy because `VITE_*` values are embedded at build time.

## What is collected

The app sends only coarse, anonymous product events after consent: page/landing views, language changes, template selection, generation success/failure, export start/completion/failure, surface preset changes, and the primary call-to-action. Event properties contain stable IDs, locale, export format/mode, and status categories. Names, query strings, generated geometry, and exported files are not sent.

PostHog autocapture, page capture, page-leave capture, cookies, and session replay are disabled.

Visitors can decline analytics and can review the policy at `/privacy.html`.

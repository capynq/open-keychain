# Analytics and error monitoring

Open Keychain generates designs and exports in the browser. PostHog does not initialize until a visitor explicitly accepts analytics in the consent banner. The same choice controls product events, autocapture, session replay, exceptions, console logs, and performance data; the privacy page provides a persistent way to accept or revoke consent, including across open tabs.

## Static-host environment variables

Set these in the Netlify production environment. The GitHub Actions workflows run `netlify build`
with the production context before deploying, so the build reads the same site settings. For local
builds, set them in your environment or `.env` file:

- `VITE_POSTHOG_KEY`: the project key from a PostHog project. Events use the first-party reverse proxy at `https://cabinet.open-keychain.com` by default. Set `VITE_POSTHOG_HOST` only when overriding that proxy host.

Never commit the project key to the repository. After changing either setting, trigger a new build
and deploy because `VITE_*` values are embedded in the bundle.

Production deployment also requires the GitHub Actions secret `POSTHOG_CLI_API_KEY`, a personal API
key scoped to Error Tracking write and organization read. CI creates hidden source maps for the
production build, injects the release metadata, uploads them to PostHog project `251074` under the
Git SHA, then deletes every `.map` before the production journey and deploy artifact. Pull requests
and local builds do not create source maps. Never add this API key to `VITE_*` variables or the
client bundle.

## What is collected

The app sends pseudonymous, coarse product events only after consent: page/landing views, language changes, template selection, generation success/failure, export dialog opens, export start/completion/failure, surface preset changes, and the primary call-to-action. `export_dialog_opened` records only the stable template ID and short-lived design ID; `export_started` additionally records the selected format and mode. In the Customizer, setup-step views/completions/abandonment use fixed step IDs. Option changes use only bundled font IDs, font category IDs, keyring position/opening preset IDs, and base/text finish profile IDs. These structured events never include names, exact dimensions, slider values, colors, generated geometry, or exported files. Session replay and autocapture are separate: after consent, recordings can include the text and settings visible in the editor, entered input values, and the live 3D/WebGL preview.

The app owns page-view events: landing routes emit `landing_view`; other routes emit `page_view`. PostHog automatic page capture stays disabled, so SPA navigation does not create a second page-view event. Customizer entry, geometry completion/failure, and export start/completion/failure include random short-lived attempt/design IDs, bounded durations, fixed outcomes, and allowlisted error codes. Geometry and export failures include a fixed operation label (`preview`, `validation`, or `export`) so those failure paths can be analyzed separately. Export failures additionally allow fixed `failure_stage` values (`initialization`, `generation`,
`serialization`, `transport`, `download`) and `error_type` values (`timeout`, `worker_error`,
`message_error`, `worker_unavailable`, `operation_error`). Each accepted export action has one
`export_attempt_id` shared by its start and terminal event; an explicit retry gets a new ID.
Repeated clicks during an active operation do not create additional attempts.
Candidate validation telemetry records bounded error codes only; raw geometry diagnostics remain local. A completed export means the file was created and the browser download was invoked, not that it was written to disk.

Every app-generated event passed through `track` includes a fixed `environment` value (`development`, `preview`, or `production`) and an `internal_traffic` boolean. Development and preview are marked internal automatically. For a production QA browser, set `localStorage.setItem('open-keychain.internal-traffic', 'true')` before the next event; remove that key to reset it. This marker is local to that browser and is not based on email, identity, or design content.

`app_version` is the full 40-character lowercase Git commit SHA embedded in the loaded frontend bundle. `app_release` is derived automatically as `<package.json version>+<app_version>`, for example `0.1.0-beta.1+efa4062529dc72def1354195254655078cfe0cd7`. Each distinct source commit therefore has its own release label, while retries of the same commit keep the same label. A development build with no Git SHA uses `<package.json version>+local`. Routine updates and pushes need no manual package-version bump or release environment variable; change the package version only for an intentional named software release. App events receive both values before they are queued; PostHog's `before_send` hook overwrites any event-level or persisted values for SDK-generated events, including autocapture, Web Vitals, and exceptions.

Non-development builds require a full SHA. Resolution order is `VITE_APP_VERSION`, Netlify `COMMIT_REF`, GitHub `GITHUB_SHA`, then local Git `HEAD`. The GitHub production workflow explicitly supplies `VITE_APP_VERSION: ${{ github.sha }}`. Direct Netlify production builds need `COMMIT_REF` or an explicit full-SHA `VITE_APP_VERSION`; no additional secret is required. A development build without Git metadata may opt into `VITE_APP_VERSION=local`. The SHA identifies the source revision, not uncommitted local edits.

Older open tabs continue to report the version embedded when they loaded; do not infer a missing version from the current deployment or assign a guessed SHA to historical events. For a fresh release, verify per-event, per-day coverage with this query (Riga-local days, browser SDK events, production traffic only, excluding internal traffic and the configured test cohort):

```sql
WITH frontend_events AS (
  SELECT
    toDate(toTimeZone(timestamp, 'Europe/Riga')) AS day,
    event,
    lower(ifNull(properties.app_version, '')) AS raw_app_version,
    match(lower(ifNull(properties.app_version, '')), '^[0-9a-f]{40}$') AS usable_version,
    ifNull(properties.app_release, '(missing)') AS app_release
  FROM events
  WHERE timestamp >= now() - INTERVAL 7 DAY
    AND properties.$lib = 'web'
    AND properties.environment = 'production'
    AND properties.internal_traffic = false
    AND person.id NOT IN COHORT 'Internal / Test users'
),
version_counts AS (
  SELECT
    day,
    event,
    app_release,
    if(usable_version, raw_app_version, '(missing/invalid)') AS app_version,
    count() AS version_event_count,
    countIf(NOT usable_version) AS missing_count
  FROM frontend_events
  GROUP BY day, event, app_release, app_version
)
SELECT
  day,
  event,
  app_release,
  app_version,
  version_event_count AS events_in_version,
  sum(version_event_count) OVER (PARTITION BY day, event) AS total_events,
  sum(missing_count) OVER (PARTITION BY day, event) AS events_missing_usable_version,
  round(
    100.0 * sum(version_event_count - missing_count) OVER (PARTITION BY day, event)
      / sum(version_event_count) OVER (PARTITION BY day, event),
    2
  ) AS coverage_percentage
FROM version_counts
ORDER BY day DESC, event, app_version
LIMIT 500
```

Pass when fresh-client production events have the expected full SHA and release label, and each production event/day has 100% usable-version coverage. No rows means there was no matching traffic and is inconclusive. Older clients can continue reporting their own bundle version and release label until they reload.

SEO pages and indexable customizer entry points are rendered by the same React application and emit
`seo_page_view`, `seo_cta_clicked`, and `seo_language_changed` after consent. Customizer entry points
use `page_type: app`; `page_id` is the stable template ID or `create`. SEO CTA events include the
originating route's stable `page_type` and `page_id`, so CTA activity can be attributed without
recording a URL. Event-specific allowlists restrict page views to `page_type`, `page_id`, `locale`,
and a sanitized route identifier; CTA clicks to `page_type`, `page_id`, `locale`, and `cta`; and
language changes to `from` and `to`. Names, raw query strings, geometry, and exported files are never
included.

After consent, the client enables autocapture, dead-click capture, Web Vitals/performance, console logs, unhandled JavaScript exceptions, unhandled promise rejections, session replay, and canvas/WebGL capture. Console errors are not duplicated as exceptions. React route-boundary errors are sent as `$exception` events with only the fixed `error_boundary: route` property. High-signal `export_failed` and React-boundary events request a 100% recording; the baseline sample is currently 100% because the verified 30-day volume was 46 consented app sessions, below the 4,000-session monthly target and 5,000-session free allowance. Recheck the 30-day count monthly and lower the baseline only while preserving 100% high-signal triggers.

Session recording deliberately unmasks input values and captures canvas because the accepted consent text names entered design text, settings, and the 3D preview. PostHog project settings currently retain recordings for 30 days. The project reports IP anonymization enabled. No cookies are used; client persistence is localStorage. A `before_send` scrub keeps URL routes while removing query strings and fragments, and strips campaign/search attribution, referrers, raw user agents, viewport dimensions, and GeoIP properties from event and person-property payloads. Session recordings, exceptions, and console logs can contain data visible in the editor or error messages, and remain pseudonymous PostHog activity rather than anonymous data.

The live project settings last verified on 2026-10-20 enabled Web Vitals, console logs, performance capture, and session recording; project exception-capture opt-in was unset while this code enables SDK exception capture. Session recording retention is 30 days, `anonymize_ips` is true, and the PostHog project is in Europe/Riga. Project-level event-trigger sampling, billing alerts, and the no-paid-overage setting still require verification in project billing/replay settings before claiming the quota controls are complete.

## Portfolio referrals

The portfolio links to
`https://open-keychain.com/?utm_source=portfolio&utm_medium=referral&utm_campaign=projects`.
Only that exact combination (with one value per parameter) produces the fixed event property
`acquisition_source: portfolio`; other query values are never copied into telemetry. Extra query
parameters are ignored and remain excluded from event URLs. Automatic campaign/referrer capture
stays disabled, and raw UTM values are still removed by `before_send`.

Before consent, only the recognized fixed marker is retained in memory so SPA navigation does not
lose it; no referral storage or analytics transmission occurs. After acceptance, the marker is
stored in session storage for this tab and attached to every app-generated event, including queued
events, geometry outcomes, and exports. It survives navigation and refresh in the same tab, but is
not a persistent person property or first-touch profile. Declining consent clears the marker and
queued events. Blocked storage falls back to memory, which does not survive refresh.

In PostHog, filter the activation funnel `landing_view → start_designing → geometry_ready →
export_completed` by `acquisition_source = portfolio`, `environment = production`, and
`internal_traffic = false`. This measures consenting visitors only. Existing event names and
pseudonymous identity remain unchanged; no new dashboard or production configuration is created.

## Customizer feedback survey

The Customizer feedback widget is configured in PostHog project `251074` and targets the `/create`
route. On 2026-10-20 it was active, shown once, and had a 30-day wait period; it asks for a required
1–5 usefulness rating and an optional single-choice reason. It has no free-text question and does
not request names, design parameters, or generated geometry. It is English-only (`translations` is
unset), and its internal targeting flag is inactive; verify consent-based delivery and targeting
behavior before changing the survey or adding response results to the dashboard.
The existing consent-gated SDK loads only after analytics is accepted; PostHog keeps surveys hidden
while capture is disabled and after opt-out. The rating-and-reason widget is the only direct prompt;
do not add another prompt until this one has impressions and the action data identifies a specific
friction point.

The existing **Open Keychain Activation** dashboard (ID `902571`) covers the activation funnel,
landing views, export outcomes, and template selection. Keep its 14-day ordered activation funnel.
Extend it with export failure breakdowns (`format`, `failure_stage`, `error_type`), Web Vitals,
exceptions, and a link to related session replay after live data is available.

Visitors can decline analytics and can review the policy at `/privacy`.

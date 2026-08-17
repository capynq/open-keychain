# Hosting readiness

Open Keychain has two deployment profiles:

- The default `docker-compose.yml` serves the local-first static application. It has no
  account, database, or required API.
- `docker-compose.hosted.yml` adds the optional Fastify API, PostgreSQL, sessions, export
  quotas, and saved project parameters behind the hosted nginx proxy.

## Staging deployment

1. Purchase or select a domain and point its DNS record at the staging host.
2. Install Docker and an HTTPS reverse proxy or certificate manager on the host.
3. Copy `.env.hosted.example` to a host-only `.env` and replace every placeholder:
   `APP_URL`, `POSTGRES_PASSWORD`, and `BETTER_AUTH_SECRET` (at least 32 random characters).
4. Start the hosted profile:

   ```sh
   docker compose --env-file .env -f docker-compose.hosted.yml up -d --build
   ```

5. Verify `/api/health`, the root route, `/create`, both export formats, and the browser
   console from a clean machine. Do not commit `.env`, database dumps, or session secrets.

The hosted frontend proxies `/api/` to the API service. Keep PostgreSQL private to the
Compose network and terminate HTTPS before the web container. `APP_URL` must match the
public HTTPS origin so secure session cookies are enabled.

## Netlify continuous deployment

The static production site can deploy without the Netlify GitHub App through
`.github/workflows/netlify.yml`. Add these repository secrets in GitHub:

- `NETLIFY_SITE_ID`: `6207cf36-da44-49e3-9639-1855c0be9cea`
- `NETLIFY_AUTH_TOKEN`: a Netlify personal access token with deploy permission

The workflow runs `pnpm build` and publishes `dist` on every push to `main`. Keep the
token only in GitHub Actions secrets; never place it in the repository or in a public log.

## Backup and recovery gate

Before inviting users:

- Take encrypted PostgreSQL backups off the primary host.
- Record the migration version and deployment image tag with each backup.
- Restore a backup on a clean host and run the health, authentication, project, quota, and
  export checks.
- Keep a rollback image and document who can rotate secrets or disable registration.

## Hosted-service limitations

Billing is intentionally disabled. The API currently supports sessions, saved parameter
projects, and export-intent quotas; it does not provide checkout, webhooks, email
verification, password recovery, account deletion/export, or a production-grade abuse and
rate-limit system. Do not advertise paid plans or collect payment until those controls and
the provider reconciliation flow are implemented.

## Private pilot gate

Start with 5–10 home-print businesses and observe real repeat-order tasks. Record:

- time from customer name to validated export;
- template, font, slicer, and printer used;
- geometry failures, quota denials, and support questions;
- whether a saved project can be reopened and printed without rework.

Public or paid launch additionally requires slicer validation and physical-print evidence;
software geometry tests alone are not a print guarantee.

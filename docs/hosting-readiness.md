# Hosting readiness

The production web application is a static build published to Netlify. The manually-triggered
workflow in [`.github/workflows/netlify.yml`](../.github/workflows/netlify.yml) builds and deploys
the validated `dist/` artifact.

Configure these GitHub Actions secrets before a production deploy:

- `NETLIFY_SITE_ID`: the Netlify site identifier.
- `NETLIFY_AUTH_TOKEN`: a Netlify personal access token with deploy permission.

The optional Fastify API remains in `server/` for separate infrastructure. It is not bundled into
the static web deployment. Run it with `pnpm server` after configuring `.env` from
[`.env.example`](../.env.example), a PostgreSQL database, and the required authentication secret.
Keep API credentials and database access outside the static hosting environment.

Before inviting users, verify the deployed root and `/create` routes, static assets, `/robots.txt`,
`/sitemap.xml`, `/llms.txt`, and the `/privacy` `X-Robots-Tag` response from a clean browser. For the
feature-flagged seller workspace, set `VITE_HOSTED_MODE=true` only after the API URL, secure cookies,
database migration, backup, and restore checks pass. Seller presets must never contain customer names or
subtitles; CSV names, generated geometry, and ZIP exports remain local to the browser. Billing is intentionally
disabled, and software geometry checks are not a substitute for physical-printer validation.

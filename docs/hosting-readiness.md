# Hosting readiness

The production web application is a static build published to Netlify. The manually-triggered
workflow in [`.github/workflows/netlify.yml`](../.github/workflows/netlify.yml) builds and deploys
the validated `dist/` artifact. Configure `NETLIFY_SITE_ID` and `NETLIFY_AUTH_TOKEN` in GitHub
Actions before a production deploy.

## Hetzner CX23 pilot API

The existing Hetzner CX23 is the pilot host for the optional Fastify API. Geometry and file generation
remain browser-side, so the 2 vCPU, 4 GB RAM, and 40 GB disk plan is sufficient at beta scale. This
is a single-server beta arrangement, not a strong uptime guarantee: we own host security, updates,
monitoring, and recovery. Upgrade the server before production if existing services regularly exceed
70–80% memory, and split the database/API when paid usage needs stronger isolation.

The deployment in [`deploy/hetzner/`](../deploy/hetzner/) is a separate Compose project. It runs
Node 22 with the existing `tsx` runtime and `pnpm server:start`, binds the API only to
`127.0.0.1:3100`, and stores PostgreSQL in the dedicated `open-keychain-postgres-data` volume.
PostgreSQL has no public host port.

Create `/etc/open-keychain/api.env` on the server from [`.env.example`](../deploy/hetzner/.env.example),
generate a unique database password and `BETTER_AUTH_SECRET` (at least 32 random characters), and
set `APP_URL=https://open-keychain.com`. Keep the file outside Git with mode `600`. `DATABASE_URL`
must use the Compose service hostname `open-keychain-postgres`.

Add an `A`/`AAAA` record for `api.open-keychain.com` to the server, install the example Nginx host,
and obtain its certificate with the existing certificate automation. Nginx forwards `Host`,
`X-Forwarded-For`, and `X-Forwarded-Proto`, and disables caching for all `/api/` responses. The
Fastify app trusts only loopback Nginx proxy addresses. Keep the Netlify rewrite unchanged:

```
/api/* https://api.open-keychain.com/api/:splat 200
```

Set `VITE_HOSTED_MODE=true` and leave `VITE_API_BASE_URL` empty in the Netlify environment only after
the API, secure cookies, migration, backup, restore, and proxy checks pass.

### First deployment

For an interactive, rerunnable bootstrap that creates the protected environment file and optionally
installs/tests Nginx and starts Compose, run `sudo deploy/hetzner/setup.sh`. It prompts before
replacing existing files and keeps timestamped backups. Set `OPEN_KEYCHAIN_ENV_FILE` and
`OPEN_KEYCHAIN_NGINX_AVAILABLE` when using non-standard paths.

From the repository checkout on the server:

```sh
docker compose -p open-keychain-api \
  -f deploy/hetzner/docker-compose.yml \
  --env-file /etc/open-keychain/api.env \
  config

docker compose -p open-keychain-api \
  -f deploy/hetzner/docker-compose.yml \
  --env-file /etc/open-keychain/api.env \
  up -d --build
```

Then verify migration completion and all three request paths:

```sh
curl -fsS http://127.0.0.1:3100/api/health
curl -fsS https://api.open-keychain.com/api/health
curl -fsS https://open-keychain.com/api/health
```

Run `nginx -t` before every reload. Manually deploy first; an optional later `workflow_dispatch`
workflow may use a dedicated restricted deploy key. Never put a Hetzner root key, password, or API
token in the repository or chat. This Codex session has no Hetzner connector, so remote actions need
your local SSH alias/deploy key or an explicitly authorized CI run.

## Protection, backups, and recovery

Configure both the Hetzner Cloud Firewall and Ubuntu firewall to allow TCP 80/443 publicly, allow SSH
only from the administration IP or VPN, and deny PostgreSQL and 3100 publicly. Do not publish a Docker
PostgreSQL port. Enable Hetzner daily server backups (seven rotating slots), and run nightly encrypted
`pg_dump` backups to separate storage. Before inviting sellers, restore a dump into a disposable
PostgreSQL database and record the result. Monitor disk, RAM, CPU, and Docker volume growth; prune
unused images carefully.

## Hosted E2E locally and in CI

The dedicated `pnpm test:e2e:hosted` command requires `E2E_DATABASE_URL` and rejects non-local database
hosts. Start disposable PostgreSQL outside this repository, then run:

```sh
E2E_DATABASE_URL=postgres://user:password@127.0.0.1:5432/open_keychain_e2e pnpm test:e2e:hosted
```

The flow creates a unique `e2e-*@example.invalid` account, verifies signup/logout/login/reload, the
first STL download, and export accounting, then deletes the account in teardown. CI should use a
disposable PostgreSQL service and retain traces on failure. Before inviting users, also verify the
root and `/create` routes, static assets, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, and the `/privacy`
`X-Robots-Tag` response. Seller presets must never contain customer names or subtitles; CSV names,
generated geometry, and ZIP exports remain local to the browser. Billing is disabled and software
geometry checks do not replace physical-printer validation.

# Self-hosting Open Keychain

Open Keychain has two self-hosting shapes: a static local-first build with no account service, and an optional hosted stack with an API and PostgreSQL. Choose the static build unless you specifically need accounts, quotas, or saved projects.

## Static Docker quick start

From the repository root:

```sh
docker compose up -d
```

Open <http://localhost:8080>. The image builds the Vite frontend and serves `dist/` from nginx. No environment variables, database, or external service are required.

## Static hosting alternative

Build the application and serve the resulting `dist/` directory from a static web server:

```sh
pnpm install
pnpm build
```

The server must serve JavaScript, CSS, SVG, PNG, `.wasm`, and `.ttf` assets without blocking or rewriting them incorrectly. The bundled Manifold runtime is loaded from `/manifold.wasm`; the font catalog loads files from `/fonts/`. Preserve the SPA fallback and the MIME types configured in [`nginx.conf`](../nginx.conf).

## Optional hosted stack

For account sessions, quotas, and saved parameter projects:

```sh
cp .env.hosted.example .env
docker compose -f docker-compose.hosted.yml up -d --build
```

Before using it with real users, replace every example secret, set a real `APP_URL`, put the services behind HTTPS, keep PostgreSQL private, and configure off-host encrypted backups. The hosted stack is experimental; billing is not enabled and operators must complete the [hosted-service readiness checklist](hosted-service.md).

## Upgrades and rollback

1. Record the current image/repository revision and database backup status.
2. Read release notes for geometry, font, schema, and migration changes.
3. Build and validate the new image in a staging or temporary environment.
4. Back up hosted PostgreSQL before applying a migration.
5. Deploy the new image and verify `/api/health`, static assets, login, project load, generation, and export.
6. If the release is bad, stop the new application image, restore the previous image, and follow the migration-specific rollback procedure. Do not assume a database migration is reversible without a tested backup.

The static build can usually be rolled back by serving the previous `dist/` artifact. Keep the artifact and its asset set together; mixing a new worker or font catalog with an old frontend can create misleading failures.

## Backup expectations

The static no-account version has no server-side project database to back up. Users are responsible for retaining exported files and any local operational records.

Hosted operators are responsible for PostgreSQL backups, restore tests, retention, encryption, access control, and incident response. Backups must be treated as sensitive because they can contain account records, project parameters, quota events, and any accepted thumbnails.

## Security responsibilities

Self-hosted operators own firewalling, HTTPS certificates, secrets, dependency/image updates, database exposure, backup protection, monitoring, logs, rate limiting, abuse response, and legal notices. Do not expose PostgreSQL publicly. Do not publish `.env` files or production secrets. Report application vulnerabilities according to [`.github/SECURITY.md`](../.github/SECURITY.md).

## Local versus hosted accounts

| Deployment   | Account required                                           | Server data                                                                             | Responsibility                                                    |
| ------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Static/local | No                                                         | None for generation and export                                                          | User/operator controls browser, files, and static hosting         |
| Hosted       | Yes for saved projects; anonymous export quotas also exist | Sessions, quota events, project parameters, schema versions, and potentially thumbnails | Operator controls API, database, backups, security, and retention |

The hosted account version does not turn generation into a server-side job. Fonts, geometry, preview, STL, and 3MF generation remain browser-side.

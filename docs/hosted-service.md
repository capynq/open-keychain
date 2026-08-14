# Hosted service

## What hosted mode is

Hosted mode is an optional account and productivity layer around the local generator. The browser still loads fonts, builds Manifold geometry, renders the preview, and serializes STL/3MF files. The current API manages:

- Better Auth email/password sessions.
- Anonymous export intents and rolling quota events.
- Authenticated project records containing a name, parameters, and schema version.
- A subscription table and provider-neutral billing interface, with billing currently disabled.

Generated meshes are not the hosted project payload. The database should not be treated as a mesh archive. The schema has a thumbnail field, but the client does not currently use a complete thumbnail workflow; any future thumbnail endpoint needs strict size, content, and retention limits.

## Current deployment

The hosted Docker Compose profile runs a static frontend, Fastify API, and private PostgreSQL service. Configuration starts from [`.env.hosted.example`](../.env.hosted.example). The current defaults include three anonymous successful exports per rolling week and paid-plan daily/minute safety limits, but there is no payment processor, checkout, or active paid entitlement flow.

The hosted profile is therefore suitable for controlled development and private testing only. It is not a promise of uptime, data retention, support response, or paid-service availability.

## Production readiness checklist

### Identity and account rights

- [ ] Use a production HTTPS domain and secure cookie configuration.
- [ ] Add email verification, password reset, password change, session management, and brute-force protection.
- [ ] Define account deletion, project deletion, and machine-readable account export.
- [ ] Verify authorization on every project and billing operation.
- [ ] Document session expiry, support access, and recovery procedures.

### Abuse and payload controls

- [ ] Add IP/account/device-aware rate limits for authentication, project writes, and export intents.
- [ ] Validate and cap project names, parameter JSON, thumbnail dimensions, encoded size, and request body size.
- [ ] Reject unexpected parameter fields and unsafe thumbnail content.
- [ ] Prevent quota bypass through anonymous-cookie rotation, replayed intents, concurrency, and failed requests.
- [ ] Add abuse reporting and an operator procedure for suspension or deletion.

### Quotas, subscriptions, and payments

- [ ] Specify free and paid entitlements in user-facing documentation.
- [ ] Enforce quotas atomically and make export accounting explainable to users.
- [ ] Select a payment provider or merchant of record after pricing, tax, region, and support review.
- [ ] Implement checkout, signed webhook verification, subscription reconciliation, failed payments, grace periods, cancellation, refunds, invoices, and customer portal.
- [ ] Test duplicate/out-of-order webhooks and provider outages.
- [ ] Never describe the current billing seam as a paid service.

### Data, operations, and recovery

- [ ] Use off-host encrypted PostgreSQL backups with a documented retention schedule.
- [ ] Test a restore on a clean host and record recovery time and recovery point results.
- [ ] Version migrations, back up before migration, and document rollback limits.
- [ ] Monitor health, latency, export-intent failures, quota denials, geometry-related client errors, database/storage usage, and payment reconciliation.
- [ ] Centralize structured logs without logging passwords, session tokens, private project data, or unnecessary customer names.
- [ ] Configure actionable alerts and an incident-response runbook.
- [ ] Define data retention and deletion for accounts, projects, thumbnails, quota events, logs, backups, and support records.

### Legal and user communication

- [ ] Publish privacy policy, terms of service, cookie disclosure, retention/deletion policy, support contact, and status/incident communication.
- [ ] Explain that local generation remains in the browser and identify the parameter/project data stored by hosted mode.
- [ ] State clearly that software-generated geometry is not a physical print guarantee.
- [ ] Document regional pricing, taxes, refunds, and service limitations before accepting payment.

See the [launch checklist](launch-checklist.md) for the sign-off order and [self-hosting guide](self-hosting.md) for operator-owned deployments.

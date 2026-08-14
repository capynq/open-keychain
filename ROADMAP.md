# Open Keychain roadmap

Open Keychain is being developed as a local-first tool for home-based 3D-printing businesses and makers. The first useful loop is deliberately small: receive a customer name, customize a printable product, preview it, export STL/3MF, print it locally, and sell it. The roadmap adds the reliability and repeat-order features needed after that first successful print.

See the [product strategy](docs/product-strategy.md), [hosted-service plan](docs/hosted-service.md), and [launch checklist](docs/launch-checklist.md) for the decisions and evidence behind these milestones.

## Status legend

- **Current** — implemented in the repository, but still subject to the relevant validation gate.
- **Planned** — intended work that is not complete.
- **Assumption** — a product or business belief that must be tested with makers.
- **Validation gate** — evidence required before calling a milestone ready.

## Readiness gates

| Milestone                                 | Acceptance criteria                                                                                                                                                    | Required documentation                                                                                                       | Operational requirements                                                                                                                                            | Known limitations before sign-off                                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Technical alpha** — current preparation | Local generation, preview, STL/3MF export, supported-template controls, and automated geometry tests work on representative inputs.                                    | README, contributor workflow, support path, export notes, and geometry test matrix.                                          | Repeatable local validation; no production user data; failures are reproducible from parameters.                                                                    | Physical print coverage, full slicer coverage, and hosted hardening are incomplete.                                       |
| **Self-hosted beta** — planned            | Static Docker image and `dist/` deployment work from a clean machine; asset loading and rollback are documented; representative models have slicer and print evidence. | [Self-hosting guide](docs/self-hosting.md), backup expectations, troubleshooting, release notes, and known-limitations list. | Operator-controlled HTTPS, image upgrades, backups for any hosted data, and security response contact.                                                              | Operators own infrastructure security, uptime, backups, and any hosted account data.                                      |
| **Private hosted beta** — planned         | 5–10 real makers complete repeat-order tasks, save/load projects, export models, report failures, and confirm the workflow is understandable.                          | Pilot brief, consent/privacy notice, support playbook, feedback form, and incident/runbook documentation.                    | Production domain and HTTPS, hardened authentication, rate limits, quotas, monitoring, backups, restore test, and manual support process.                           | Billing is disabled; account recovery, deletion/export, and some abuse controls must be complete before wider access.     |
| **Public hosted beta** — planned          | Stable onboarding, support, quota behavior, project recovery, documented incidents, and acceptable geometry/print failure rates across the published matrix.           | Public terms, privacy/cookie/retention notices, FAQ, status communication, release notes, and data-export instructions.      | Alerting, migration procedure, tested restore, audit logs, abuse handling, and defined support response expectations.                                               | Service is still beta; pricing and availability may change; no paid entitlement should be promised until billing is live. |
| **Paid production service** — planned     | Makers demonstrate repeat usage and willingness to pay; payment lifecycle is reconciled; operational and print-quality gates have owners and evidence.                 | Pricing, terms, refund policy, invoice/customer-portal instructions, SLA or support policy, and launch retrospective.        | Payment provider, checkout, signed webhooks, failed-payment handling, cancellation, refunds, invoices, customer portal, backups, monitoring, and incident response. | MIT permits competing hosted forks; the service cannot rely on source-code exclusivity.                                   |

## Geometry and print-quality validation

The application can report software-generated geometry as valid, but that does not prove a physical print will succeed. Every release that changes geometry, fonts, templates, or export serialization should maintain a fixture report with these layers:

- **Input matrix:** every supported template; every supported style combination; all bundled fonts that are selectable for the template; Latin and Cyrillic names; short and long names; narrow and wide glyphs; spaces, counters, descenders, and mixed-case examples.
- **Geometry checks:** finite coordinates, manifold status, shell/component count, bounds, base-on-Z=0, minimum wall thickness, relief depth, edge inset, keyring-hole diameter, clearances, connectors, and articulated joint/motion invariants.
- **Export checks:** parse generated STL and 3MF files; confirm object count, merged/separate behavior, color/material assignments, valid ZIP/XML structure, bounds, and slicer import.
- **Slicer checks:** open representative files in the supported slicer workflow and record warnings, repair prompts, estimated dimensions, and object/material interpretation.
- **Physical checks:** print representative cases on at least two common FDM printer models with 0.4 mm and 0.6 mm nozzle scenarios. Record printer, nozzle, material, layer height, slicer profile, orientation, supports, print time, failures, minimum reliable features, and photos or inspection notes.
- **Regression fixtures:** retain known-good and known-bad cases for manifold geometry, thin walls, clearances, holes, connectors, counters, long names, and articulated parts.

Documentation and release notes must label each result as one of:

- **Software-generated:** passed automated geometry/export checks only.
- **Slicer-validated:** imported into the stated slicer without an unresolved issue.
- **Physically print-verified:** printed with the stated printer, nozzle, material, and profile.

## Hosted SaaS readiness

The hosted API and UI are experimental foundations, not a production SaaS. The missing gates are:

- Production HTTPS, domain, secure cookie configuration, session expiry, email verification, password reset, password change, account deletion, and account data export.
- Rate limiting, brute-force protection, abuse prevention, payload size limits, request validation, and protection of project parameters and thumbnail payloads.
- Enforced anonymous quotas, authenticated quotas, subscription entitlements, and clear user-facing quota errors.
- Payment provider integration with checkout, signed webhooks, subscription reconciliation, failed payments, cancellation, refunds, invoices, and a customer portal.
- Off-host encrypted backups, tested restore on a clean host, migration versioning, rollback procedure, monitoring, structured logs, alerts, storage/latency/export metrics, and an incident-response runbook.
- Privacy policy, terms of service, cookie disclosure, data retention/deletion policy, support contact, and a clear statement that fonts and generated meshes remain client-side.

No public hosted launch should be announced until the [hosted-service checklist](docs/hosted-service.md) and [launch checklist](docs/launch-checklist.md) are signed off.

## Commercial workflow roadmap

Prioritize recurring value for small sellers over one-off customization polish:

| Priority | Capability                                                            | Current state                                                                          | Validation requirement                                                                                          |
| -------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| P0       | Saved projects; search; rename; duplicate; delete; version history    | Basic authenticated save/list/load exists; the rest is planned.                        | Makers can reliably find and reopen a customer order after several days.                                        |
| P0       | Seller presets for common fonts, templates, sizes, and print profiles | Planned.                                                                               | Presets measurably reduce setup time without hiding important print constraints.                                |
| P1       | Batch generation/export and order lists with customer references      | Planned.                                                                               | A seller can process a realistic small batch without confusing filenames or mismatched customers.               |
| P1       | Printable labels or order sheets                                      | Planned.                                                                               | The output fits an existing packing/production workflow and prevents order mix-ups.                             |
| P1       | Client preview links                                                  | Planned.                                                                               | A client can review the intended name/product without receiving account access or editable production controls. |
| P2       | Collections and reusable product libraries                            | Planned.                                                                               | Sellers reuse successful designs across multiple orders.                                                        |
| P2       | Additional product templates                                          | Planned; candidate examples include Cable tag, Pen holder, Picture frame, and Planter. | Each template has its own geometry and physical-print validation matrix.                                        |
| P3       | Optional team or organization workspaces                              | Planned, only after solo-seller workflows prove valuable.                              | Multiple users, ownership, permissions, billing, and deletion semantics are understood.                         |

## Launch and distribution sequence

1. **Local discovery:** publish the browser/static build, examples, setup documentation, and reproducible issue templates. Focus on privacy, no-account use, and fast experimentation.
2. **Self-hosted beta:** distribute tagged Docker/static releases to technically capable makers and collect slicer/print reports.
3. **Private hosted beta:** recruit 5–10 real makers through direct outreach and relevant maker communities. Observe repeat-order tasks rather than only collecting feature requests.
4. **Public hosted beta:** publish limitations, support expectations, data policies, status communication, and the hosted setup path. Keep a usable local/self-hosted alternative.
5. **Paid production:** launch only after repeat usage, payment lifecycle, legal documents, operational recovery, and physical-print evidence meet the gate.

The [market-validation plan](docs/market-validation.md) defines the evidence to collect at each stage. The [licensing guide](docs/licensing.md) documents why MIT allows both self-hosted and competing hosted distributions.

## Operational maturity after launch

- Move backups off the primary VPS and test recovery on a clean host.
- Add metrics for export success, quota denials, geometry failures, latency, storage usage, and payment reconciliation without collecting generated meshes unnecessarily.
- Add a second API instance and managed/failover database only after beta traffic justifies the operational cost.
- Review the roadmap after each pilot and release; correctness, security, and print reliability take priority over template expansion.

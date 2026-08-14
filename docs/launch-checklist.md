# Launch checklist

Use this checklist to decide whether a release is ready for the next audience. A checked software test is not a substitute for a checked physical print.

## Technical alpha

- [ ] Local build works from a clean checkout.
- [ ] `pnpm validate`, geometry matrix, and browser tests pass.
- [ ] Every supported template/style combination has representative fixtures.
- [ ] STL and 3MF outputs are parsed and checked for structure, bounds, object count, and colors.
- [ ] Known limitations and reproducible issue-report fields are documented.
- [ ] No generated mesh or font file is sent to a server in the default build.

## Self-hosted beta

- [ ] `docker compose up -d` works on a clean machine.
- [ ] Static `dist/` hosting instructions work independently of Docker.
- [ ] WASM, fonts, SPA fallback, and MIME types are verified.
- [ ] Representative exports import into the intended slicer without unresolved repair warnings.
- [ ] At least two FDM printer models and 0.4/0.6 mm nozzle scenarios are recorded.
- [ ] Upgrade, rollback, backup, and security responsibilities are documented.
- [ ] A tagged release includes known limitations and a support path.

## Private hosted beta: 5–10 makers

- [ ] Recruit 5–10 makers who actually fulfill personalized orders.
- [ ] Each participant completes: create name, change template/font, export, print, save project, reopen project, and repeat the workflow.
- [ ] Collect printer, nozzle, material, slicer, print result, and failure evidence.
- [ ] Observe whether saved projects and presets reduce repeat-order time.
- [ ] Record quota confusion, account failures, geometry failures, and support burden.
- [ ] Use a production HTTPS domain, hardened authentication, rate limits, quotas, monitoring, backups, and a tested restore.
- [ ] Provide a privacy notice and an explicit process for pilot data deletion.

## Public hosted beta

- [ ] Publish privacy policy, terms, cookie disclosure, retention policy, support expectations, and service limitations.
- [ ] Complete password reset, account deletion, account export, project deletion, and authorization tests.
- [ ] Enforce request/payload limits and protect thumbnails, parameters, logs, and backups.
- [ ] Test migrations, restore, alerts, incident response, and quota enforcement under concurrency.
- [ ] Publish geometry and physical-print coverage with the software-generated/slicer-validated/physically print-verified distinction.
- [ ] Keep the local/static alternative available and documented.

## Paid production service

- [ ] Confirm repeat usage and willingness to pay from pilot evidence.
- [ ] Publish pricing, taxes, refunds, invoices, and support terms.
- [ ] Integrate checkout, signed webhooks, failed-payment handling, cancellation, refunds, and customer portal.
- [ ] Reconcile provider state with local subscription state and test duplicate/out-of-order events.
- [ ] Set backup, restore, alert, incident, and support ownership.
- [ ] Review bundled fonts, dependencies, MIT obligations, and commercial distribution notices.
- [ ] Announce the service only after all production gates are signed off.

## Distribution sequence

1. Publish the local/static build with examples and clear setup instructions.
2. Use tagged releases and direct outreach to recruit self-hosted testers.
3. Run the 5–10-maker private pilot through direct maker contacts and relevant communities.
4. Open public hosted beta only with published limitations and support channels.
5. Introduce paid plans only after the commercial, legal, operational, and print-quality evidence is complete.

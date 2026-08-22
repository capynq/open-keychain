# Release checklist

Use this checklist for a customer-facing release. Keep operational evidence with the release artifact rather than in the browser bundle.

- [ ] Build the production `dist/` artifact locally and complete the desktop, narrow, tablet, and localized customizer smoke checks.
- [ ] Verify Randomize, Undo, stale-preview export blocking, STL/3MF downloads, share-link fallback, and session-only appearance overrides.
- [ ] Confirm that appearance overrides and customizer state stay local to the session and are not added to persistence or telemetry.
- [ ] Attach the CI gate summary, geometry matrix summary (2,359 cases), and browser report to the release.
- [ ] Keep physical printer/slicer validation explicitly deferred until printer and customer access is available; do not substitute simulated evidence.

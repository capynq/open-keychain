# Release checklist

Use this checklist for a customer-facing release. Keep operational evidence with the release artifact rather than in the browser bundle.

- [ ] Build the production `dist/` artifact locally and complete the desktop, narrow, tablet, and localized customizer smoke checks.
- [ ] Verify Randomize, Undo, stale-preview export blocking, STL/3MF downloads, share-link fallback, and session-only appearance overrides.
- [ ] Confirm that appearance overrides and customizer state stay local to the session and are not added to persistence or telemetry.
- [ ] Attach the CI gate summary, geometry matrix summary (2,359 cases), and browser report to the release.
- [ ] Run the opt-in PrusaSlicer smoke check (`pnpm validation:fixtures && pnpm validate:slicer`) and attach its result manifest and exact slicer/profile versions.
- [ ] Complete manual slicer inspection and physical-printer evidence using `docs/print-validation.md`; the smoke check is not a physical-print guarantee.

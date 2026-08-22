# Release checklist

Use this checklist for a customer-facing release. Keep operational evidence with the release artifact rather than in the browser bundle.

- [ ] Deploy the built `dist/` artifact to staging and complete the desktop, narrow, tablet, and localized customizer smoke checks.
- [ ] Verify Randomize, Undo, stale-preview export blocking, STL/3MF downloads, share-link fallback, and session-only appearance overrides.
- [ ] Configure production analytics with the approved privacy settings and confirm a non-identifying health event.
- [ ] Verify the generated SEO pages, sitemap, robots policy, and Search Console submission status.
- [ ] Attach the CI gate summary, geometry matrix summary (2,359 cases), browser report, and deployment URL to the release.
- [ ] Record hosting backup/restore evidence and staging rollback readiness.
- [ ] Keep physical printer/slicer validation explicitly deferred until printer and customer access is available; do not substitute simulated evidence.

# Open Keychain roadmap

## Beta gate

- Keep the existing Name keychain template printable across all supported Latin and Cyrillic fonts.
- Ship Articulated name with rounded per-letter borders, connector joints, preserved counters, and one manifold export.
- Ship Nameplate with configurable corner radius, inset padding, thickness, and relief.
- Ship Plant label with a configurable narrow text stand (20–30% of text height), embedded raised lettering, and pointed printable stake.
- Keep template-scoped style capability metadata so each template can gain its own style family without expanding the global style switch; articulated names currently use a dedicated style-free recipe.
- Complete the geometry matrix for every template, font script, and representative narrow/wide name.
- Run the Hetzner hosted profile with account sessions, three anonymous exports per rolling week, paid-plan entitlement seams, and saved-project gallery.
- Verify backups, restore procedures, HTTPS, rate limits, and no-secret client bundles.

## Hosted beta improvements

- Add a real billing provider adapter after validating tax, region, pricing, and support requirements.
- Add paid plan checkout, portal, cancellation, webhook reconciliation, and entitlement history.
- Add project thumbnails, duplicate/rename/delete actions, and export history.
- Add premium local scene presets for wood, metal, and studio board previews.

## Product expansion

- Add Cable tag, Pen holder, Picture frame, and Planter templates.
- Add batch export, printable labels, project collections, and organization sharing.
- Add additional bilingual calligraphic fonts after license and glyph-coverage review.
- Add server-rendered high-quality thumbnails only if client-side scenes are insufficient.

## Operational maturity

- Move backups off the primary VPS and test recovery on a clean host.
- Add metrics for export success, quota denials, geometry failures, latency, and storage usage without collecting generated meshes.
- Add a second API instance and managed/failover database only after beta traffic justifies the operational cost.

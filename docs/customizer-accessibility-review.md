# Customizer accessibility review — 2026-10-19

Scope: new recovery, font chooser, Photo/Share popovers and preview controls. Tested using
Playwright with installed Google Chrome 152, not the bundled Chromium executable.
The reference is [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/).

| Before                                                                  | After                                                                              | Why                                               |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------- |
| Pale focus and low-contrast export/small text                           | Dark Workshop focus, export and readable text tokens                               | Visible keyboard focus and sufficient contrast    |
| Duplicate font tab IDs and global keyboard lookup                       | Instance-specific IDs and local tab navigation                                     | Reliable dialog focus and tab/panel relationships |
| Alerts contained interactive recovery content                           | Only the problem is announced; actions and disclosures remain separate             | Predictable announcements and keyboard access     |
| Stacked previews or controls collapsed; doubled text overflowed         | Nonshrinking stacked panels, wrapping choices, scrollable failed previews          | Usable tablet, narrow and enlarged-text layouts   |
| Photo selection relied on shadows; failed-preview arrows rotated camera | Forced-color selection borders and native radio navigation; arrows scroll recovery | High-contrast and keyboard usability              |

## Validation

- Chrome desktop, mobile and mobile-2x profiles; explicit 320px, tablet and landscape viewports.
- EN/RU/UK at doubled root text, text-spacing overrides, reduced motion, forced colors,
  keyboard focus, tab relationships, disclosure targets, popup alignment and overflow.
- axe-core 4.14: 30 sampled states with zero reported WCAG-tagged violations and no page overflow.
  Automated scans supplement the keyboard and visual checks; they are not a conformance certificate.
- New persistent coverage: `e2e/recovery-accessibility.spec.ts` (21 profile cases).
- Existing scoped contextual-actions/recovery coverage passed after correcting a native-radio
  keyboard fixture. Font tab, localized targets, tablet order, font page and finish layout checks
  were also exercised. The older online-font failure assertion was updated to the centralized
  recovery message and alert semantics.
- Build, typecheck, lint, explicit-file `validate:changed`, diff check and 20 focused unit tests.

Browser artifacts and logs are under `/private/tmp/ui-*`; axe evidence is
`/private/tmp/keychain-ui-audit.json`. Run Chrome coverage with:

```sh
PLAYWRIGHT_CHANNEL=chrome pnpm exec playwright test e2e/recovery-accessibility.spec.ts
```

VoiceOver and physical touch-device testing were not performed. Existing Firefox startup
restrictions from the earlier preview repair remain outside this Chrome audit.

## Copy-link follow-up

Added a shared, bottom-centered confirmation toast with success artwork, a clear title and paste
instruction, 44px dismissal, polite announcement, six-second auto-dismissal paused during hover or
focus, and reduced-motion support. At narrow widths the description uses the full card width.
X now uses its documented `https://x.com/intent/tweet` endpoint. Chrome directly opened all four
social URLs with a harmless example URL: Telegram and WhatsApp displayed it; Facebook reached its
login gate; X returned HTTP 200 (its composer did not render in the automated session). No sign-in
or posting was performed. These checks establish routing, encoding and reachable destinations,
not successful posting through authenticated accounts.

Sources: [X Web Intents](https://docs.x.com/x-for-websites/web-intents/overview),
[Telegram sharing](https://core.telegram.org/widgets/share),
[WhatsApp click to chat](https://faq.whatsapp.com/5913398998672934).

## Actual design-payload audit

After the reported empty Facebook composer, tested the local app's generated design URL rather
than an example URL. Telegram and WhatsApp displayed the exact `localhost` design URL. X's login
redirect retained the URL and design payload. Facebook returned its login gate, preventing a check
of the authenticated composer. No accounts were accessed and no messages/posts were sent.
A separate public-site test restored a nondefault `SHARE CHECK` design from the v11 URL format.

Strengthened Chrome regression assertions to decode every social destination's design payload and
verify the original origin, locale and text. Three profile cases passed; changed-file validation and
diff check passed. Source-page confirmation (local or public) is needed to diagnose the user's
Facebook result. Local URLs are not reachable by remote recipients; reaching a share page alone
must not be reported as verified successful composition or posting.

Evidence: `/private/tmp/real-social-results.log`, `/private/tmp/public-design-restoration.log`,
`/private/tmp/share-payload-chrome-final.log`.

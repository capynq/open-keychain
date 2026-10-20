# Customizer recovery

The canonical error inventory is `src/shared/lib/recovery/catalog.ts`. Each stable code maps to
an EN/RU/UK explanation, recovery steps and a strategy. `RecoveryError` carries a code and optional
measured edge context through the worker boundary. Unknown failures receive a localized fallback;
raw diagnostics stay inside a closed native disclosure.

## Recovery behavior

A rejected edit keeps the accepted design visible. **Fix this** opens an anchored popover in the
editor or an inline disclosure in the font dialog. Opening it checks at most two proposed fixes,
sequentially, in a separate disposable geometry worker. Only printable, verified proposals become
applicable. Closing recovery or making another edit cancels the background worker.

Applying a proposal commits the verified geometry and requested font together. Request, parameter,
font metadata and font-byte guards reject stale proposals. **Undo fix** restores the previous
accepted design. No proposed fix changes the entered text, hardware, safety settings or size envelope.

| Failure family                                        | Suggested actions and fallback                                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Text edge too large, invalid or topologically unsafe  | Keep the requested font with a measured smaller edge; try sharp text edges. Review the affected setting if neither validates. |
| Backing edge too large or wall too thin               | Reduce the backing edge using the measured maximum; try a sharp backing edge.                                                 |
| Font loading, missing glyphs or empty outlines        | Check a compatible bundled font; review/search the font. Local file failures offer import/reconnect again or built-in fonts.  |
| Text dimensions or size limits                        | Check a smaller text preset; otherwise edit name and size. The size envelope is preserved.                                    |
| Disconnected or unsafe geometry                       | Check an adjacent weight/spacing preset or compatible font, according to the failure; otherwise review the affected control.  |
| Worker failure or timeout                             | Retry the current operation. A newer edit superseding an older build is cancellation, not an error.                           |
| Google font network/catalog failure                   | Retry when configured; use built-in fonts. Invalid/oversized responses explain the provider limitation.                       |
| Preview module or renderer failure                    | Retry loading/restart preview, with reload as a fallback. Renderer restart retains inspection framing.                        |
| Photo capture, encoding, format or download failure   | Retry the selected export; offer a smaller supported resolution where available.                                              |
| Model export failure                                  | Retry export without discarding the design.                                                                                   |
| Device share or clipboard failure                     | Retry the relevant operation; copy or select the share URL manually. Cancelling device sharing is neutral.                    |
| Invalid shared design, setup or randomization failure | Start a new design, revisit the setup size/fonts step while retaining the draft, or retry randomization.                      |
| Unknown failure                                       | Keep the accepted design, review the affected setting and expose diagnostics on request.                                      |

## Extension contract

Add a stable producer code to the catalog and all three locales. Keep measured context finite and
small; never serialize arbitrary errors or font data. Feature owners provide typed actions to the
shared `RecoveryNotice`; the shared UI does not mutate domain state. Recovery validation uses the
same geometry/printability checks as normal candidate acceptance.

Coverage includes catalog/producer and locale consistency, stale and failed proposals, font identity,
worker cancellation, requested-font preservation, Undo, and 320px doubled-text EN/RU/UK popovers.

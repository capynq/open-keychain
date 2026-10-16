# Customizer parameter audit

Source audit: three separate Luna investigations, 2026-10-16. This is a control inventory and
focused regression record, not exhaustive geometric proof for every font/text combination.

| Surface                                                            | Disposition                                                 | Implementation / acceptance                                                                    |
| ------------------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Backing Chamfer/Round                                              | Reported default maximum rejection not reproduced           | Default ALEX/Nunito assembled maximum regressions; keep existing topology/contact limits.      |
| Text Chamfer/Round                                                 | Profile maxima checked by full builder                      | Include subtitle intersection and final connectivity in regressions.                           |
| Slot length                                                        | Offered values below effective width/minimum                | Dynamic step-aligned minimum >= 4 mm and slot width.                                           |
| Magnet Plain/Ribbon radius                                         | Values above 5 mm silently capped                           | Offer at most 5 mm.                                                                            |
| Ribbon notch                                                       | Tail-dependent hidden cap                                   | Share tail-based, step-aligned bounds; reconcile tail changes.                                 |
| Halo, ring offset, articulated boss                                | Dependency edits could leave values beyond displayed bounds | Reconcile padding/text-size/connector changes in the candidate transaction only.               |
| Nameplate radius                                                   | Estimated UI bound omitted actual footprint/margin          | Publish measured geometry maximum; apply to candidate and revalidate before acceptance.        |
| Plant stake shoulder                                               | Width plateau beyond effective maximum                      | Publish foundation-derived maximum and reconcile candidate.                                    |
| Common text size, weight, spacing, padding, base/relief, subtitles | Source ranges match normalization                           | Context-dependent geometric rejection remains possible; no universal font compatibility claim. |
| Keyring width, positioning, opening shapes                         | Source ranges/options consumed                              | Slot dependency fixed above; preserve supported-template applicability.                        |
| Heart size, border, gaps, offset, relief/through-cut modes         | Source bounds/presets consistent                            | Existing explicit assembly policy retained; full combination matrix remains pending.           |
| Articulated clearance, gap, angle, connector, thickness            | Source bounds consistent                                    | Boss dependency fixed above; geometry invariants remain authoritative.                         |
| Plant length, radius, accents; bubble/tag/arch details             | Source audit found no permanently dead offered endpoint     | Existing conservative plant-radius bound retained.                                             |
| Magnet pocket presets/placements                                   | Valid or explicitly adjusted with warning                   | Large pockets may allow only subtle directional movement; not classified as failure.           |
| Templates/styles/fonts/colors, finish profiles, Simple presets     | Applicability/filtering and transactional paths inspected   | Preserve existing category/font compatibility and preset defensive filtering.                  |

Known limit: the user-observed finish rejection still needs an exact failing state if the default
regressions remain green. Do not call that report fixed without reproducing it. Default browser slider endpoints and responsive captures are now verified. The exhaustive
control-effect matrix and physical printing remain separate follow-up work.

2026-10-16 regression evidence: 721 unit tests, 4,267 geometry/export cases (3 expected-invalid,
zero unexpected failures), and the complete public/hosted browser gates passed. Browser End-key
checks accept displayed backing/text Chamfer and Round maxima on desktop/mobile/mobile-2x.
This does not replace an exhaustive numeric-control-effect matrix or physical printing.

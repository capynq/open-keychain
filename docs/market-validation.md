# Market validation

This plan tests whether Open Keychain solves a recurring production problem for small sellers, rather than only attracting one-off experimentation.

## Hypotheses

| Hypothesis                                                                    | Evidence needed                                                    | Current status     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------ |
| Sellers receive enough personalized orders to repeat the workflow weekly.     | Interviews and observed order-processing tasks.                    | Assumption         |
| Local generation and no-account use are meaningful trust or privacy benefits. | User preference and workflow comparison.                           | Assumption         |
| Saved projects and seller presets reduce repeat-order setup time.             | Timed first-order versus repeat-order tasks.                       | Planned validation |
| Batch export and customer references prevent production mistakes.             | Small-batch task with deliberate similar names.                    | Planned validation |
| 3MF color-aware export reduces slicer or multi-material setup friction.       | Slicer task using separate and merged 3MF modes.                   | Planned validation |
| A hosted account is worth paying for after local workflow value is proven.    | Pricing interviews, pilot retention, and willingness-to-pay tests. | Assumption         |

## Private pilot: 5–10 makers

Recruit makers who already sell or fulfill personalized 3D-printed products. Prefer a mix of printer models, nozzle sizes, materials, and Latin/Cyrillic customer names where possible.

Each participant should complete:

1. Create a short and a long name using two templates and two fonts.
2. Export STL and both 3MF modes, then import them into the participant's slicer.
3. Print at least one standard model and one edge case.
4. Save a project, reopen it later, and reproduce the intended design.
5. Process a small batch with customer references, even if the batch feature is simulated manually.
6. Explain which missing feature would most improve their next ten orders.

Collect only the information needed for the pilot: workflow observations, print parameters, failure evidence, timing, feedback, and explicit consent for any screenshots or photos. Do not collect customer personal data unnecessarily.

## Measures

- Time from customer request to export.
- Time to reproduce a previous order.
- Export success rate by template/font/name class.
- Slicer warnings and repair prompts.
- Physical print success, reprints, and minimum reliable feature observations.
- Number of manual steps or external tools required per order.
- Repeat use within one or two weeks.
- Support questions per participant.
- Interest in saved projects, presets, batch export, and client preview links.
- Stated willingness to pay and the workflow value attached to it.

Do not treat sign-ups, likes, or requests for more fonts as proof of commercial value. The strongest evidence is a seller returning with another real order and using the product faster or with fewer mistakes.

## Decision rules

- **Continue local/self-hosted investment** when makers complete the workflow and physical print failures are diagnosable.
- **Prioritize commercial features** when repeat-order time or order mix-ups are the dominant pain.
- **Delay paid hosted launch** when users value the local tool but do not need accounts, or when operational/support burden exceeds recurring value.
- **Pause template expansion** when existing templates lack broad slicer and physical-print evidence.

Record findings in release notes or a maintainer decision log, then update the [roadmap](../ROADMAP.md) with validated evidence rather than converting every request directly into a feature.

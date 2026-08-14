# Product strategy

## Positioning

Open Keychain is a local-first browser tool for home-based 3D-printing businesses and makers who turn personalized names into physical products. It is not primarily a generic 3D editor: its value is the short path from a customer request to a printable, previewable, exportable product.

The core workflow is:

```text
customer name → customize product → preview → export STL/3MF → print locally → sell
```

The local-first boundary keeps font processing, geometry generation, preview, and export in the browser. A hosted profile is an optional productivity layer for accounts, quotas, and saved parameters; it is not required to generate or export a model.

## Users and jobs to be done

| User              | Immediate job                                      | Product expectation                                                                                  |
| ----------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Hobby maker       | Make an occasional personalized object             | No account, quick setup, privacy, understandable controls, and broad slicer compatibility            |
| Home-based seller | Turn repeated name requests into reliable products | Saved projects, presets, batch processing, order references, and confidence that the file will print |
| Future small team | Share a product library and production queue       | Permissions, collections, client review, and organization billing; not a first-launch requirement    |

The product should optimize for the seller who repeats a small set of successful products. A one-off feature is lower priority if it does not reduce setup time, prevent order mistakes, improve print reliability, or create reusable value.

## Current state

- **Current:** local React/Three.js/Manifold WASM generation, preview, STL/3MF export, four templates, five backing recipes, bundled Latin/Cyrillic fonts, and automated geometry tests.
- **Current but experimental:** hosted email/password sessions, anonymous export quotas, authenticated parameter projects, and a provider-neutral billing seam.
- **Not production-ready:** physical print coverage, full hosted security/operations, account recovery and deletion/export, payment processing, and repeat-order tooling.

## Product principles

1. **Local generation by default.** Fonts and generated meshes should not need to leave the browser.
2. **Print evidence over visual confidence.** A pretty preview is not a print guarantee.
3. **Simple controls for ordinary users.** Expose only parameters that work for the active template and style.
4. **Repeat orders are the commercial north star.** Projects, presets, batches, and order references matter more than an ever-growing control panel.
5. **Open distribution is a feature.** MIT licensing supports self-hosting and commercial use, while also allowing modified hosted forks.

## Assumptions to validate

- Home-based sellers receive enough personalized orders that saved parameter projects and presets are valuable.
- Local generation and no-account use are meaningful trust or privacy benefits for makers.
- A small seller will prefer a narrow set of reliable templates over a large unverified catalog.
- 3MF color-aware export reduces setup friction for multi-material or multi-color workflows.
- A hosted account is worth paying for only when it saves repeat-order time or prevents mistakes.

The [market-validation plan](market-validation.md) defines interviews, pilot tasks, and evidence thresholds. The [roadmap](../ROADMAP.md) defines the engineering and launch gates.

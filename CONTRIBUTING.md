# Contributing

Open Keychain is a client-side React, Three.js, and Manifold project. Geometry and exports run locally in a worker, so changes should preserve printable, manifold output and keep preview-only surfaces out of files.

Before opening a pull request:

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm bench:matrix
pnpm test:e2e
```

Use the existing style and camera tests as templates for new geometry cases. Add a regression test for every new validation rule, export format, locale, or viewer interaction.

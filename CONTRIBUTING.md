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

## Formatting

Run `pnpm format` before committing and use `pnpm format:check` in CI. TypeScript and JavaScript use a 100-column print-width guideline; Markdown, JSON, stylesheets, and generated declaration/configuration files retain a 120-column width. Prettier's `objectWrap: "preserve"` keeps an object literal multiline when its opening brace is followed by a newline, while long single-line objects wrap automatically at the configured width.

Prettier does not infer semantic groups between variables and methods. The targeted ESLint `padding-line-between-statements` rule inserts a blank line after declarations before expressions or returns in React feature code; keep one intentional blank line between hook calls, derived values, effects, handlers, and returns. Prettier preserves it but collapses repeated blank lines.

Use the existing style and camera tests as templates for new geometry cases. Add a regression test for every new validation rule, export format, locale, or viewer interaction.

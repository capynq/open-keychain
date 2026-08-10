## Summary

Describe the change and the user-facing behavior it affects.

## Validation

- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm bench:matrix` (when geometry or font behavior changes)
- [ ] `pnpm test:e2e --workers=1` (when UI or export behavior changes)
- [ ] Relevant E2E or benchmark checks

## Checklist

- [ ] Conventional commit messages are used.
- [ ] Documentation and localization are updated where needed.
- [ ] Exported geometry remains one printable manifold with an open keyring hole.
- [ ] No secrets, generated artifacts, or production environment files are included.

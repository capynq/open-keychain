# Validation profiles

Routine GitHub Actions checks classify changed paths once (`changes`) and run the selected gates in
three parallel jobs: `static` (format, lint, typecheck), `unit` (related tests on 4 Vitest workers)
and `browser` (build, changed specs, smoke and the critical journey on 2 Playwright workers). A
small `quality` job passes only when every selected job passed; it stays the stable required branch
and production-deploy status. Intentionally unselected checks are printed as `not selected`, and an
unselected job is skipped.

Changed Playwright specs run on the `desktop` and `mobile` projects. A changed spec that depends on
the pixel ratio (it names `mobile-2x` or reads `devicePixelRatio`/`deviceScaleFactor`) also runs
on `mobile-2x`; the critical journey always covers all three. A push to `main` that merges a pull
request skips the `browser` job, because the pull request ran it and `production-build` reruns the
critical journey on the exact production artifact; a direct push to `main` still runs it. CI
installs Chromium without apt and falls back to `playwright install-deps` only when the runner
image lacks a library.

| Change                        | Routine gates                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| Documentation                 | Changed-file formatting                                                                                  |
| Geometry, export, fonts, WASM | Related Unit tests and explicit dynamic-boundary tests, typecheck, build; skip Browser and full Geometry |
| UI/app                        | Related Unit tests, typecheck, build, Browser smoke                                                      |
| Changed Playwright spec       | That spec directly                                                                                       |
| Test-only                     | Changed tests only                                                                                       |
| Validation/config tooling     | Related and owning tests, with typecheck/build when applicable                                           |
| Unknown paths                 | Format/lint, typecheck, build                                                                            |

Static test discovery uses `vitest related --run`. It cannot discover relationships behind runtime-computed
dynamic imports, so worker, font, and builder boundaries have explicit test mappings. Deleted and
renamed path names remain in classification; missing paths are removed only from executable test
arguments. An empty related-test selection is reported as not selected, never as a passing suite.

`pnpm validate:full` is the exhaustive local regression command. It runs full format, lint,
typecheck, Unit, build, Browser, and the 4,267-case Geometry matrix. `workflow_dispatch` runs those
full suites on a hosted runner when hosted exhaustive validation is needed. That manual profile is
intentionally sequential in one `full` job.

# Validation profiles

Routine GitHub Actions checks classify changed paths and run selected required gates sequentially
in the single `quality` job, after one dependency install. The job is the stable required branch and
production-deploy status. A selected gate failure fails `quality`; intentionally unselected checks
are printed as `not selected`.

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
full suites on a hosted runner when hosted exhaustive validation is needed. It is intentionally
sequential to keep the routine workflow's one-runner/one-install design simple.

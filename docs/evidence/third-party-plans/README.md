# Remediation plans for third-party WebMCP apps

`aic generate webmcp-plan` run against four public WebMCP applications, none of them ours. Generated
2026-09-03 from the same shallow clones used for the [safety census](../webmcp-census.md).

| App | Status | Workstreams |
|---|---|---|
| [`vincanger/webmcp-espresso-store`](https://github.com/vincanger/webmcp-espresso-store) | `review_needed` | 3 |
| [`GoogleChromeLabs/webmcp-tools`](https://github.com/GoogleChromeLabs/webmcp-tools) | `review_needed` | 4 |
| [`WebMCP-org/examples`](https://github.com/WebMCP-org/examples) | `blocked` | 4 |
| [`Leanmcp-Community/music-composer-webmcp`](https://github.com/Leanmcp-Community/music-composer-webmcp) | `not_detected` | 2 |

`blocked` means obsolete `navigator.modelContext` usage that must be migrated first. `not_detected`
is an honest miss: that app registers through its own runtime shim, which static scanning cannot
attribute to WebMCP — see the census for why.

## Why plans and not pull requests

These are read-only analyses of other people's code. Nothing here was modified, forked, deployed, or
submitted, and no plan was sent to any maintainer.

`vincanger/webmcp-espresso-store` in particular **carries no LICENSE file**, so it is all-rights-
reserved by default: reading it is fine, redistributing or hosting a modified copy is not. That
alone rules out shipping an "AIC-enabled espresso store" as a demo, and we would not have done it
regardless — these repositories are the evidence for our finding, not our raw material.

## What these demonstrate

That the adapter's analysis is not tuned to our own example. It reads unfamiliar third-party code —
Wasp, React, Angular, Rails, Phoenix LiveView, vanilla TS — identifies which registrations are
ungoverned, and emits concrete per-app remediation steps.

The generated plans are readiness analysis, not executed proof. They say what would need authoring;
they do not claim any of it has been done.

```bash
pnpm aic generate webmcp-plan ./src --out-file ./webmcp-plan.json
```

These plans were generated with the repository build. The published `@aicorg/cli@alpha` accepts the
same command but predates wrapper-hook detection, so for apps registering through `use-webmcp-tool`
it reports `not_detected` and emits a thinner plan.

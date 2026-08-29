# 🚀 AIC Public Update — Adoption Path Is Live

AIC has moved past “interesting prototype” territory.

The repo now has a real adoption path, real proof, and a much cleaner story for teams who want to try it without guessing.

## What’s New

- 🧩 A canonical guide for adding AIC to an existing React, Next.js, or Vite app
- 🤖 Repo-local and published CLI flows for `init`, `doctor`, `generate`, and `inspect`
- 🔌 MCP setup docs plus both handler-level and real stdio MCP smoke coverage
- 🔐 An optional Auth0 integration path for teams that want enterprise-friendly auth around agent-enabled apps
- 📊 Better proof packaging through case studies instead of stuffing everything into the main README

## Why This Matters

The big idea behind AIC is simple:

> stop making agents guess what your UI means

Instead of screenshots, selectors, and “click the blue button that kind of looks right,” AIC gives apps a stable contract for:
- identity
- action semantics
- risk
- confirmation
- workflow context
- entity targeting

That makes agents more reliable, and it makes app teams more comfortable letting them operate real workflows.

## What You Can Do Right Now

If you want the fastest path:

```bash
npx @aicorg/cli@alpha init ./my-app
npx @aicorg/cli@alpha doctor ./my-app
npx @aicorg/cli@alpha generate project ./my-app/aic.project.json --out-dir ./my-app/public
```

If you want the repo-local path:

```bash
pnpm aic --help
pnpm smoke:init
pnpm smoke:adoption
pnpm smoke:mcp
pnpm smoke:mcp:stdio
```

## Where To Start

- 🧩 Existing app guide: [Adopt AIC in an Existing App](./adopt-existing-app.md)
- 🔌 MCP setup: [MCP Server](./mcp-server.md)
- 🔐 Optional auth path: [Auth0 for AI Agents with AIC](./auth0-ai-agents.md)
- 📊 Proof: [AIC Case Studies](./case-studies.md)

## Short Version

AIC is now at the point where a new team can:
- clone the repo
- instrument one real slice
- generate manifests
- connect an MCP-compatible agent
- and validate that the app contract is readable without brittle UI guessing

That’s the milestone that matters.

# 🛠️ Adopt AIC In One Sitting

If you already own a React, Next.js, or Vite app, AIC is now set up for a pretty simple first pass.

No giant migration. No rewrite. No “annotate the whole app before anything works.”

Just one slice.

## The Goal

Pick one workflow that actually matters:
- a risky action
- a destructive action
- an entity-scoped action
- or a multi-step flow where agents usually get confused

Then make *that one thing* contract-readable.

## The 15-Minute Path

```bash
npx @aicorg/cli@alpha init ./my-app
npx @aicorg/cli@alpha doctor ./my-app
npx @aicorg/cli@alpha generate project ./my-app/aic.project.json --out-dir ./my-app/public
```

Then:
- mount `AICProvider`
- annotate one real control
- run `inspect`
- connect an MCP-compatible agent

## The Tiny Mental Model

Before AIC:
- “there’s a button here, I think”

After AIC:
- “this is `checkout.submit_order`”
- “it is critical risk”
- “it requires confirmation”
- “it belongs to workflow step `checkout.review.submit`”

That difference is the whole game.

## What To Annotate First

Start with:
- 🔥 destructive actions
- 🧾 submit/confirm actions
- 🧠 entity-scoped record actions
- 🪜 workflow checkpoints

Do **not** start by annotating every random button in the app. That is how you create busywork instead of value.

## What “Done” Looks Like

After one good first pass, you should have:
- a valid `aic.project.json`
- onboarding files like `AGENTS.md` and `CLAUDE.md`
- generated discovery/UI/actions/permissions/workflows artifacts
- a clean `doctor` run
- one workflow an agent can resolve by contract instead of guessing

## Best Starting Point

Use:
- [Adopt AIC in an Existing App](./adopt-existing-app.md)

That’s the canonical path in this repo now.

## Short Version

You do not need to “AIC-ify” the entire app.

Pick one painful workflow. Make it explicit. Let the agent stop guessing.

That’s enough to know whether AIC is worth expanding.

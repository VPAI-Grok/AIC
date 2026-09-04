# YouTube upload copy

## Title — pick one

The first is the strongest hook; the second is the most searchable.

1. `We scanned every public WebMCP app. None can tell an agent which tools are dangerous.`
2. `AIC — risk, permissions and discovery for WebMCP apps (WebMCP Hackathon)`
3. `An AI agent bought something from a real store. Then it tried to check out.`

## Description

Paste everything below the line. Replace nothing except the census link if you re-publish it.

---

WebMCP lets a web page hand real tools to an AI agent. It does not let the page say which of those
tools are dangerous.

We scanned every public WebMCP application we could find: 75 tools across 5 apps, 49 of them
mutating — book_table, submit_order, delete_note, checkout. Not one can express enforceable risk,
because a WebMCP tool descriptor supports exactly two annotations: readOnlyHint and
untrustedContentHint. When an author knows an action is irreversible, the only place to say so is an
English sentence in the description field. Nothing enforces it, and no agent can check it before
acting.

AIC — Agent Interaction Control — is an open-source layer that fixes that. In this demo we retrofit
it onto a real third-party storefront with 16 WebMCP tools, govern 2 of them, and leave 14 exactly
as the original author wrote them. Then we let Claude Code loose on the store through Chrome DevTools
MCP.

The agent searches the catalog, checks a water filter actually fits the machine, finds a coupon and
fills a cart — five tool calls, no permission asked, because none of that is consequential. Then it
tries to check out, and stops: checkout is declared risk "critical", so it needs a human. Decline,
and the order is refused with the cart still full. Approve, and it goes through.

Same agent, same tool, same call. The only variable is whether a person agreed.

CHAPTERS
0:00 A real store with 16 agent-callable tools
0:15 The warning that nothing enforces
0:33 The census: 75 tools, 49 mutating, 0 governed
0:50 An agent goes shopping on its own
1:40 It tries to check out — and is stopped
2:10 Two tools governed, fourteen untouched
2:24 Publishing risk in /.well-known/agent.json
2:38 Scan your own app in one command

LINKS
Repository — https://github.com/VPAI-Grok/AIC
Live demo — https://agentinteractioncontrol.vercel.app
Prompt-injection comparison — https://agentinteractioncontrol.vercel.app/injection
Discovery manifest — https://agentinteractioncontrol.vercel.app/.well-known/agent.json
The WebMCP Safety Census — https://claude.ai/code/artifact/a4bc346e-19be-434b-b135-415b2fa6c4c5
The adapter on npm — https://www.npmjs.com/package/@aicorg/webmcp

SCAN YOUR OWN WEBMCP APP
npx -y @aicorg/cli@alpha scan ./src --webmcp

CREDIT
The storefront is Crema & Co. by Vince Canger, used and modified with the author's permission:
https://github.com/vincanger/webmcp-espresso-store
It is a well-built WebMCP app. It appears here as the example of a problem the protocol creates, not
a problem its author made.

SPEC PROPOSAL
We think risk annotations belong in WebMCP itself rather than in userland — a riskHint beside
readOnlyHint, or a confirmation lifecycle the browser mediates. Draft:
https://github.com/VPAI-Grok/AIC/blob/main/docs/proposals/webmcp-risk-annotations.md

Submitted to the WebMCP Hackathon — https://webmcp.devpost.com
Apache-2.0.

---

## Tags

```
WebMCP, Model Context Protocol, MCP, AI agents, agentic browsing, AI safety, prompt injection, Chrome, browser API, Next.js, React, TypeScript, open source, developer tools, human in the loop, AI agent safety, Claude, hackathon
```

## Upload settings

- **Visibility: Unlisted or Public.** Not Private — Devpost judges cannot open a private video, and
  this is the single most common way a submission gets zero-scored.
- **Category:** Science & Technology
- **Audience:** "No, it's not made for kids"
- **Thumbnail:** the frame where the confirmation dialog is open over the full cart. If YouTube's
  auto-frames are all terminal text, upload a custom one — a screenshot of that moment.

## Before you paste

- **Fix the chapter times if your take runs long.** YouTube only renders chapters if the first is
  `0:00`, there are at least three, and each is at least 10 seconds. Wrong timestamps look sloppier
  than none at all — check them against the finished video.
- **Share the census artifact.** It is private by default. A judge clicking a private link sees
  nothing.

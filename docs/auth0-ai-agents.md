# Auth0 For AI Agents With AIC

Use this guide when you want Auth0 to handle identity and authorization around an AIC-enabled app.

## What Auth0 Does vs What AIC Does

Auth0 and AIC solve different parts of the problem:

- Auth0 handles user identity, login, token issuance, and authorization policy.
- AIC publishes the app contract that an agent needs to operate the UI safely:
  - discovery
  - UI state
  - actions
  - permissions
  - workflows

Auth0 does not replace AIC manifests. AIC does not replace app authentication or OAuth.

## Recommended Position

Treat Auth0 as an optional integration, not a required AIC dependency.

Use Auth0 when you need one or more of these:
- authenticated access to the app or its backend APIs
- user-to-agent delegation
- scoped token exchange for downstream APIs
- centralized authorization policy for agent-facing operations

## Where Auth0 Fits

### 1. Human user signs in

Your app uses Auth0 for normal application login.

That protects:
- the app shell
- backend APIs
- any manifest endpoints that should not be public

### 2. The app serves AIC manifests under normal app auth

Your app still emits:
- `/.well-known/agent.json`
- `/.well-known/agent/ui`
- `/.well-known/agent/actions`
- `agent-permissions.json`
- `agent-workflows.json`

Whether those endpoints are public or authenticated is your product choice. Auth0 can protect them the same way it protects the rest of the app.

### 3. The agent uses authenticated app access

The browser automation tool or MCP-connected client accesses the app as an authenticated user.

That gives the agent:
- the same app permissions as the user or delegated session
- access to the AIC contract
- access to protected backend data needed to complete workflows

### 4. Optional: third-party APIs through Auth0 Token Vault

If the app needs to call third-party APIs on behalf of the user, Auth0 Token Vault is the right place for delegated external credentials.

That is useful when an agent needs to:
- operate your UI through AIC
- and also call external APIs on the user’s behalf without storing raw third-party tokens inside your app

## Recommended Architecture

Use this split:

- Auth0:
  - login
  - session/token issuance
  - API protection
  - delegated third-party API access
  - fine-grained authorization if needed
- AIC:
  - UI/action/workflow publication
  - agent-readable risk and confirmation metadata
  - entity-scoped operation contracts
  - workflow and recovery semantics

## MCP And Auth0

If you use `@aicorg/mcp-server`, keep the server itself simple and read-only.

Recommended pattern:
- the MCP server reads AIC manifests from the app over HTTP
- the app is already protected with normal Auth0-backed auth where needed
- the MCP client or surrounding tool handles authenticated access to the app environment

Do not make Auth0 a hard requirement inside `@aicorg/mcp-server` unless you are building a separate authenticated hosted MCP deployment story.

## Suggested First Integration

For a first production path:

1. Protect the app with Auth0 as usual.
2. Keep AIC manifests available to authenticated users of the app.
3. Let the agent operate the app through an authenticated browser/session.
4. Use AIC for contract resolution and safe execution.
5. Add Auth0 Token Vault only if the agent must also call external APIs on behalf of the user.

## What To Avoid

- Do not couple core AIC packages to Auth0 SDKs.
- Do not position Auth0 as a substitute for explicit `agent*` metadata.
- Do not make OAuth setup part of the minimum AIC quickstart.
- Do not treat protected auth as a replacement for risk, confirmation, workflow, or entity semantics.

## Good Fit

Auth0 is a good fit when you want:
- an existing enterprise auth provider
- agent access tied to real user identity
- protected app/API access around AIC manifests
- delegated external API access

## Not Required

You do not need Auth0 to use AIC.

The current minimum AIC adoption loop remains:
- instrument one slice
- run `aic doctor`
- run `aic generate`
- run `aic inspect`
- connect an MCP-compatible agent

## Related Docs

- [Adopt AIC In An Existing App](/mnt/c/users/vatsa/agentinteractioncontrol/docs/adopt-existing-app.md)
- [MCP Server](/mnt/c/users/vatsa/agentinteractioncontrol/docs/mcp-server.md)
- [Coding Agents](/mnt/c/users/vatsa/agentinteractioncontrol/docs/coding-agents.md)

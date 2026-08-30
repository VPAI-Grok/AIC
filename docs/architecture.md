# AIC — Agent Interaction Control: Full Architecture

## System Overview

AIC is a **contract-first framework** that makes web apps reliably operable by AI agents. It does this by:

1. **Authoring** — developers annotate UI elements with stable `agent*` props
2. **Generating** — build-time tools extract those annotations into standardized JSON manifests
3. **Serving** — framework plugins expose manifests on `.well-known/` HTTP endpoints at runtime
4. **Consuming** — the MCP server exposes those manifests as tools that any AI agent can call
5. **Proving** — protocol-neutral contracts and executed observations verify behavior across UI, WebMCP, MCP, and API surfaces
6. **Attesting** — signed statements bind a passed proof to an issuer, origin, deployment, and source revision for independent verification
7. **Relying** — an agent, gateway, or release system applies its own fail-closed policy to the exact target immediately before execution

---

## Package Dependency Graph

```mermaid
graph TD
    subgraph SPEC["📐 @aicorg/spec — Source of Truth"]
        types["types.ts (all AIC types)"]
        authoring["authoring.ts (patch plan builder)"]
        validate["validate.ts (manifest validators)"]
        diff["diff.ts (manifest diff engine)"]
        behavior["behavior.ts (behavior contracts and proof types)"]
        trust["trust.ts (signed claims, trust stores, registries)"]
        reliance["reliance.ts (decisions, resolver records, snapshots)"]
    end

    subgraph RUNTIME["⚙️ @aicorg/runtime"]
        registry["AICRegistry (in-memory element store)"]
        attributes["createAICDataAttributes (data-agent-* attrs)"]
    end

    subgraph SDK["⚛️ @aicorg/sdk-react"]
        provider["AICProvider (React context)"]
        useElement["useAICElement hook"]
        components["AIC.Button / Input / Select / Form / Table"]
        createComp["createAICComponent factory"]
    end

    subgraph AUTOMATION["🔧 @aicorg/automation-core"]
        scanner["scanSourceForAICAnnotations (TypeScript AST)"]
        analyzer["analyzeProjectForAICAnnotations (file walker)"]
        generator["generateProjectArtifacts (manifest builder)"]
        doctor["createAICDoctorReport"]
        initializer["initializeAICProject (scaffolding)"]
        verifierCompatibility["verify-core compatibility re-exports"]
        conformanceAuthoring["conformance, interop, and key-transition tooling"]
        writer["writeArtifactFiles"]
    end

    subgraph VERIFY["🔐 @aicorg/verify-core — Minimal Verifier"]
        canonicalVerifier["canonical JSON and digest"]
        trustVerifier["attestation and registry verification"]
        policyVerifier["proof regeneration and policy evaluation"]
        transparencyVerifier["checkpoint and consistency verification"]
    end

    subgraph EVIDENCE["🌐 @aicorg/evidence-playwright"]
        browserRunner["Chromium evidence session"]
        nativeWebMCP["document.modelContext inspection and execution"]
    end

    subgraph RELY["🛡️ @aicorg/rely"]
        evaluateReliance["evaluateAICReliance"]
        assertReliance["assertAICRelianceAllowed"]
        preflight["createAICReliancePreflight"]
    end

    subgraph RESOLVER["🪞 @aicorg/reliance-server"]
        resolverLookup["exact assurance lookup and history"]
        resolverSnapshot["portable mirror snapshot"]
        resolverEvaluate["optional locally configured evaluator"]
    end

    subgraph RELY_ACTION["✅ actions/aic-rely"]
        actionBundle["bundled offline GitHub preflight"]
    end

    subgraph BOOTSTRAP["🤖 @aicorg/ai-bootstrap"]
        crawler["capturePagesWithPlaywright"]
        promptBuilder["createBootstrapSuggestionPrompt"]
        reviewer["generateBootstrapReview"]
        reporter["renderBootstrapReport"]
    end

    subgraph BOOTSTRAP_HTTP["🌐 @aicorg/ai-bootstrap-http"]
        httpProvider["createHttpBootstrapSuggestionProvider"]
    end

    subgraph BOOTSTRAP_OAI["🔑 @aicorg/ai-bootstrap-openai"]
        openaiProvider["createOpenAIBootstrapSuggestionProvider"]
    end

    subgraph CLI["🖥️ @aicorg/cli (aic)"]
        cmd_scan["aic scan"]
        cmd_init["aic init"]
        cmd_doctor["aic doctor"]
        cmd_validate["aic validate"]
        cmd_verify["aic verify"]
        cmd_trust["aic trust keygen/attest/verify"]
        cmd_registry["aic registry build/verify/query"]
        cmd_rely["aic rely evaluate"]
        cmd_bootstrap["aic bootstrap"]
        cmd_generate["aic generate project/discovery/ui/permissions/operate"]
        cmd_authoring["aic generate authoring-plan"]
        cmd_apply["aic apply authoring-plan"]
        cmd_diff["aic diff"]
        cmd_inspect["aic inspect"]
    end

    subgraph MCP["🔌 @aicorg/mcp-server"]
        tool_discover["discover_aic_app"]
        tool_ui["get_aic_ui_state"]
        tool_elements["list_aic_elements"]
        tool_permissions["get_aic_permissions"]
        tool_workflows["get_aic_workflows"]
        tool_actions["get_aic_actions"]
    end

    subgraph DEVTOOLS["🔍 @aicorg/devtools"]
        bridge["AICDevtoolsBridge (throttled snapshot dispatcher)"]
        overlay["AICDevtoolsOverlay (inspector UI)"]
        inspectorHook["useAICInspectorSnapshot"]
        domCandidates["collectAICDomDiscoveryCandidates"]
        extensionShell["createAICDevtoolsExtensionShell"]
    end

    subgraph PLUGINS["🔗 Framework Plugins"]
        pluginVite["@aicorg/plugin-vite createAICVitePlugin"]
        pluginNext["@aicorg/plugin-next createAICNextPlugin"]
    end

    subgraph INTEGRATIONS["🎨 Component Integrations"]
        radix["@aicorg/integrations-radix"]
        shadcn["@aicorg/integrations-shadcn"]
    end

    RUNTIME --> SPEC
    SDK --> RUNTIME
    SDK --> SPEC
    AUTOMATION --> RUNTIME
    AUTOMATION --> VERIFY
    AUTOMATION --> SPEC
    VERIFY --> SPEC
    EVIDENCE --> SPEC
    RELY --> VERIFY
    RELY --> SPEC
    RESOLVER --> VERIFY
    RESOLVER --> SPEC
    RELY_ACTION --> RELY
    PLUGINS --> AUTOMATION
    PLUGINS --> SPEC
    CLI --> AUTOMATION
    CLI --> RELY
    CLI --> BOOTSTRAP
    CLI --> BOOTSTRAP_HTTP
    CLI --> BOOTSTRAP_OAI
    CLI --> RUNTIME
    CLI --> SPEC
    MCP --> SPEC
    DEVTOOLS --> SDK
    DEVTOOLS --> SPEC
    BOOTSTRAP_HTTP --> BOOTSTRAP
    BOOTSTRAP_OAI --> BOOTSTRAP
    INTEGRATIONS --> SDK
```

---

## Runtime Data Flow (App in Browser)

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant JSX as React Component (JSX)
    participant Hook as useAICElement
    participant Reg as AICRegistry
    participant DOM as DOM (data-agent-* attrs)
    participant Agent as AI Agent / MCP

    Dev->>JSX: Add agentId, agentRisk, agentDescription, etc.
    JSX->>Hook: useAICElement(props, options)
    Hook->>Hook: buildElementManifest(props)
    Hook->>Reg: registry.register(element, instanceId, authored)
    Reg->>Reg: mergeElementSources (authored > inferred > ai_suggested)
    Reg->>Reg: emit element_registered event
    Hook->>DOM: createAICDataAttributes(element)
    Note over DOM: data-agent-id, data-agent-role, data-agent-risk, data-agent-action, data-agent-entity-*, data-agent-workflow
    Agent->>DOM: GET /.well-known/agent/ui
    DOM-->>Agent: AICRuntimeUiManifest (JSON)
```

---

## Build-Time Artifact Generation Flow

```mermaid
flowchart LR
    SRC["Source Files (.tsx / .jsx)"]

    subgraph AUTOMATION_CORE["@aicorg/automation-core"]
        TS["TypeScript AST Parser"]
        SCANNER["scanSourceForAICAnnotations → AICSourceScanMatch[]"]
        GENERATOR["generateProjectArtifacts"]
    end

    CONFIG["aic.project.json"]

    subgraph ARTIFACTS["Generated .well-known Artifacts"]
        A1["/.well-known/agent.json (discovery)"]
        A2["/.well-known/agent/ui (runtime UI manifest)"]
        A3["/.well-known/agent/actions (semantic actions)"]
        A4["/agent-permissions.json"]
        A5["/agent-workflows.json"]
        A6["/operate.txt (agent instructions)"]
        A7["/report.json (onboarding report)"]
    end

    SRC --> TS --> SCANNER --> GENERATOR
    CONFIG --> GENERATOR
    GENERATOR --> ARTIFACTS
```

---

## Well-Known Endpoint Map

| Endpoint | Manifest Type | Description |
|---|---|---|
| `/.well-known/agent.json` | `AICDiscoveryManifest` | App name, version, supported capabilities, endpoint URLs |
| `/.well-known/agent/ui` | `AICRuntimeUiManifest` | All rendered elements with full metadata |
| `/.well-known/agent/actions` | `AICSemanticActionsManifest` | Pre/post-conditions, completion signals, side-effects |
| `/agent-permissions.json` | `AICPermissionsManifest` | Risk-band policies, forbidden actions, reauth requirements |
| `/agent-workflows.json` | `AICWorkflowManifest` | Named multi-step workflows with entry points & rollback |
| `/operate.txt` | Plain text | Human-readable AIC summary for agent system prompts |

---

## MCP Server — AI Agent-Facing Tools

```mermaid
flowchart TD
    AGENT["AI Agent (Claude, Gemini, GPT, etc.)"]

    subgraph MCP_SERVER["@aicorg/mcp-server (stdio transport)"]
        T1["discover_aic_app → GET /.well-known/agent.json"]
        T2["get_aic_ui_state → GET /.well-known/agent/ui"]
        T3["list_aic_elements → GET /.well-known/agent/ui + filter"]
        T4["get_aic_permissions → GET /agent-permissions.json"]
        T5["get_aic_workflows → GET /agent-workflows.json"]
        T6["get_aic_actions → GET /.well-known/agent/actions"]
    end

    APP["Running Web App (with AIC plugin)"]

    AGENT -->|MCP protocol| MCP_SERVER
    MCP_SERVER -->|HTTP fetch| APP
    APP -->|JSON manifests| MCP_SERVER
    MCP_SERVER -->|structured results| AGENT
```

## WebMCP — Browser-Native Execution

`@aicorg/webmcp` is a separate, feature-detected compatibility adapter. WebMCP supplies browser-native tool discovery and invocation. AIC consumes native protocol capabilities first and currently adds fail-closed readiness gates while the API remains experimental.

The adapter does not convert runtime elements or generated actions automatically. Only an explicit task-level binding backed by an authored `execution_ready` action contract can register. The human UI and tool path must call the same application/domain function.

The read-only MCP server and AIC manifests remain available for headless discovery, unsupported browsers, and consumers that need the richer AIC contract surface.

## Behavior Assurance — Protocol-Neutral Proof

Behavior Assurance sits below individual protocols:

```mermaid
flowchart LR
    CONTRACT["aic_behavior_contract"]
    HARNESS["trusted local harness or imported observations"]
    UI["human UI"]
    WEBMCP["WebMCP"]
    OTHER["MCP / OpenAPI / custom"]
    VERIFY["verifyAICBehavior"]
    PROOF["aic_behavior_proof"]

    CONTRACT --> VERIFY
    HARNESS --> UI
    HARNESS --> WEBMCP
    HARNESS --> OTHER
    UI --> VERIFY
    WEBMCP --> VERIFY
    OTHER --> VERIFY
    VERIFY --> PROOF
```

The contract maps protocol-specific entrypoints to one stable domain `operation_id`. The verifier checks expected status, confirmation, error, outcome, required and forbidden behavior, and canonical parity across required surfaces. Proofs include evidence classification and SHA-256 digests. Signing remains a separate layer so proof semantics do not depend on one issuer or registry.

See [Behavior Assurance](./behavior-assurance.md).

## AIC Verified — Portable Trust Claims

```mermaid
flowchart LR
    PROOF["passed behavior proof"]
    DEPLOY["origin + deployment + revision"]
    STATEMENT["aic_trust_statement"]
    SIGN["Ed25519 signature"]
    REGISTRY["embedded-attestation registry"]
    STORE["consumer-pinned trust store"]
    VERIFY["verifyAICSignedAttestation"]

    PROOF --> STATEMENT
    DEPLOY --> STATEMENT
    STATEMENT --> SIGN --> REGISTRY --> VERIFY
    STORE --> VERIFY
```

The browser evidence package executes real rendered human controls and native WebMCP tools. The trust engine binds the resulting passed proof to deployment claims and signs canonical JSON with Ed25519. Registries remain untrusted discovery surfaces; verification uses consumer-pinned issuer keys and re-derives every convenience field.

The GitHub workflow adds a second provenance layer by using GitHub OIDC/Sigstore artifact attestation for the complete evidence archive on trusted runs. Neither signature layer alone proves that a production origin is currently reachable.

See [AIC Verified Trust Layer](./trust-layer.md).

## Open Ecosystem Conformance

The ecosystem layer keeps protocol execution, behavior proof, conformance, and consumer reliance separate:

```mermaid
flowchart LR
    BROWSER["human UI / WebMCP"] --> OBS["behavior observations"]
    HTTP["HTTP / OpenAPI plan"] --> OBS
    MCP["MCP plan"] --> OBS
    REMOTE["remote deployment preflight"] --> HTTP
    REMOTE --> MCP
    CONTRACT["authored behavior contract"] --> PROOF["regenerated proof"]
    OBS --> PROOF
    PACK["versioned conformance pack"] --> CONF["digest-bound conformance result"]
    BINDING["authored application mapping"] --> CONF
    PROOF --> CONF
    POLICY["consumer assurance policy"] --> DECISION["canonical reliance decision"]
    PROOF --> DECISION
    CLAIM["signed deployment claim"] --> DECISION
    CONF --> DECISION
    HISTORY["optional signed history"] --> DECISION
    RESOLVER["untrusted mirrorable resolver"] -. candidate records .-> DECISION
    DECISION --> PREFLIGHT["agent / gateway / release preflight"]
    PREFLIGHT --> NATIVE["WebMCP / MCP / HTTP / UI execution"]
```

`@aicorg/evidence-core` owns strict plans, projections, artifacts, receipts, and bundle verification. `@aicorg/evidence-http` and `@aicorg/evidence-mcp` adapt their native protocols. `@aicorg/runner-remote` adds exact production identity, public-network pinning, bounded execution, and operator capabilities; it never executes submitted code.

`@aicorg/conformance-packs` supplies versioned operation-class obligations. The application binding is explicit and digest-bound. `@aicorg/verify-core` contains the minimal trust, proof-regeneration, assurance-policy, and transparency verifier used by reliance gates, without loading the scanner/compiler toolchain. `@aicorg/automation-core` re-exports those primitives for compatibility and adds conformance, portable compatibility suites, scheduled dual-signed key transitions, scanning, and authoring.

The deployment application's source revision and the runner software revision are distinct bindings. They are not required to match.

See [Protocol Evidence and Remote Observation](./evidence-adapters.md), [Conformance Packs](./conformance-packs.md), [Assurance Policy](./assurance-policy.md), and [Transparency and Key Rotation](./transparency-and-key-rotation.md).

## Trust Fabric — Consumer-Owned Preflight

`@aicorg/rely` is the canonical relying-party boundary. It receives caller-supplied artifacts only, regenerates the proof through the assurance-policy evaluator, verifies the signed claim against a separately supplied trust store, checks the exact origin, operation, deployment, revision, freshness, revocation state, and any policy-required signed transparency history, then returns an `aic_reliance_decision` with `allow`, `confirm`, `deny`, or `indeterminate`.

The decision is intentionally protocol-neutral. Thin adapters place the same guard before a WebMCP tool, MCP `tools/call`, HTTP mutation, browser action, or release promotion. They do not replace protocol-native authorization, confirmation, or invocation.

`createAICReliancePreflight` canonical-snapshots caller inputs, evaluates against a trusted current clock, re-evaluates after a clock advance, and locally reproduces the entire decision before returning. `assertAICRelianceAllowed` snapshots the complete consumer-owned input before touching an untrusted raw decision, canonical-clones that decision without evaluating accessors, re-evaluates at the claimed time, and returns the detached result only after a full canonical match. Trusted time and optional residual validity are checked after reproduction. Fabricated or stateful results, forged deadlines, missing, extra, or substituted artifacts, a different request audience, future or over-age decisions, and decisions at their exclusive `valid_until` fail. Every portable `allow` is capped at 60 seconds and shortened to the earliest applicable evidence, attestation-expiry, or transparency-checkpoint boundary.

The bundled `actions/aic-rely` JavaScript action applies the same verifier to bounded, regular JSON files in a GitHub runner without downloading a verifier at runtime. It pins the consumer policy and trust-store file digests plus explicit issuer, key, runner, origin, environment, deployment, operation, and revision identities. It succeeds only for a canonical `allow` produced at the runner's current time with at least 30 seconds of residual validity by default, and exposes the exclusive deadline separately so callers do not mistake a persisted boolean for authorization.

`@aicorg/reliance-server` is a read-only Fetch API reference service. It provides exact lookups, history, and exportable snapshots for independent mirrors. Those records are `unverified_discovery`; the service does not fetch artifact references or execute submitted code. Its optional `POST /v1/rely` endpoint uses an operator-configured local evaluator and rate limiter, but clients can always reproduce the decision locally. Resolver availability, DNS, and operator identity never become implicit trust anchors.

The package and action surfaces above are implemented in this repository. They are not yet evidence of npm publication, a public hosted resolver, external consumers, operator independence, or certification. See [AIC Trust Fabric](./trust-fabric.md) and [ADR 0005](./adr/0005-trust-fabric-reliance-network.md).

---

## Bootstrap Pipeline (AI-Assisted Annotation)

```mermaid
flowchart TD
    URL["Target App URL (+ optional routes CSV)"]
    PW["Playwright: capturePagesWithPlaywright"]
    CAPTURES["Page Captures (DOM snapshots)"]
    PROMPT["createBootstrapSuggestionPrompt"]

    subgraph PROVIDERS["Suggestion Providers"]
        HTTP["HTTP Provider (custom LLM endpoint)"]
        OPENAI["OpenAI Provider (gpt-4o etc.)"]
        STATIC["Static Provider (from file, for testing)"]
    end

    DRAFT["Bootstrap Draft (raw AI suggestions)"]
    REVIEW["generateBootstrapReview (confidence filter, deduplication)"]
    REPORT["Bootstrap Report (markdown summary)"]
    PLAN["aic generate authoring-plan → AICAuthoringPatchPlan"]
    APPLY["aic apply authoring-plan → writes agent* props to JSX"]

    URL --> PW --> CAPTURES --> PROMPT
    PROMPT --> HTTP
    PROMPT --> OPENAI
    PROMPT --> STATIC
    HTTP --> DRAFT
    OPENAI --> DRAFT
    STATIC --> DRAFT
    DRAFT --> REVIEW --> REPORT
    REVIEW --> PLAN --> APPLY
```

---

## CLI Command Reference

| Command | Purpose |
|---|---|
| `aic init [root]` | Scaffold `aic.project.json`, `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`, `.cursor/rules/aic.mdc` |
| `aic scan <path>` | AST-scan for `agent*` props → JSON report of matches & diagnostics |
| `aic scan <path> --webmcp` | Detect governed, direct, declarative, and obsolete WebMCP usage |
| `aic doctor [root]` | Audit onboarding files, config, source annotations, and workflows |
| `aic doctor [root] --webmcp` | Add WebMCP compatibility and source-readiness findings to doctor output |
| `aic validate <kind> <file>` | Validate a manifest or behavior contract |
| `aic verify <behavior-contract> --harness <module>` | Execute observations, verify scenarios and parity, and emit a behavior proof |
| `aic trust keygen` | Generate an Ed25519 issuer key and pinned trust store |
| `aic trust attest` | Bind and sign a passed proof for an exact origin, deployment, and revision |
| `aic trust verify` | Verify signature, issuer policy, expectations, contract, and proof bindings |
| `aic registry build/verify/query` | Publish and consume independently verifiable signed-claim registries |
| `aic evidence run-remote/verify` | Collect a data-only production job and recompute its bundle/receipt bindings |
| `aic conformance list/show/bind/verify` | Inspect packs, author digest-bound mappings, and verify contract or proof conformance |
| `aic policy evaluate` | Regenerate proof and apply cumulative consumer reliance policy |
| `aic rely evaluate` | Produce a canonical, fail-closed pre-execution decision for an exact operation and deployment |
| `aic interop verify` | Execute portable canonicalization, digest, attestation, and registry vectors |
| `aic transparency init/append/verify/consistency` | Operate and verify the signed reference history format |
| `aic trust rotate/transition` | Prepare, verify, and apply dual-signed scheduled key transitions |
| `aic bootstrap <url>` | Crawl with Playwright → LLM suggestions → bootstrap draft & report |
| `aic generate project <config>` | Full artifact generation from `aic.project.json` |
| `aic generate authoring-plan` | Build a proposal list from a runtime snapshot + bootstrap review |
| `aic generate webmcp-plan <path>` | Build a phased WebMCP migration and hardening plan |
| `aic apply authoring-plan` | Patch JSX source files with `agent*` props from a plan |
| `aic diff <kind> <before> <after>` | Diff two manifest versions (summary or detailed) |
| `aic inspect <file>` | Pretty-print and describe a manifest file |

---

## AIC Spec — Core Type Hierarchy

```mermaid
classDiagram
    class AICElementManifest {
        +string id
        +string label
        +AICRole role
        +AICRisk risk
        +AICElementAction[] actions
        +AICElementState state
        +AICConfirmationProtocol confirmation
        +AICEntityRef entity_ref
        +AICExecutionMetadata execution
        +AICRecoveryMetadata recovery
        +AICValidationMetadata validation
        +string workflow_ref
        +AICRiskFlag[] risk_flags
    }

    class AICRuntimeUiManifest {
        +string spec
        +AICPageMetadata page
        +AICViewMetadata view
        +AICElementManifest[] elements
        +AICRelationship[] relationships
        +JsonObject user_context
    }

    class AICDiscoveryManifest {
        +string spec
        +string app name and version
        +AICDiscoveryCapabilities capabilities
        +AICDiscoveryEndpoints endpoints
    }

    class AICPermissionsManifest {
        +Record riskBands
        +string[] forbiddenActions
        +Record actionPolicies
    }

    class AICWorkflowManifest {
        +AICWorkflowDefinition[] workflows
    }

    class AICSemanticActionsManifest {
        +AICActionContract[] actions
    }

    AICRuntimeUiManifest "1" --o "many" AICElementManifest
    AICWorkflowManifest "1" --o "many" AICWorkflowDefinition
    AICSemanticActionsManifest "1" --o "many" AICActionContract
```

---

## Metadata Provenance Priority

The `AICRegistry` merges element registrations from three sources. Higher priority wins on conflicts:

```
ai_suggested  (lowest — from bootstrap AI)
    ↓
inferred      (middle — computed from DOM/AST)
    ↓
authored      (highest — explicit agent* props by developer)
```

All sources are tracked in the `provenance` field on each element manifest.

---

## Risk Levels and Confirmation Protocol

| Risk | Meaning | Typical Policy |
|---|---|---|
| `low` | Read-only or trivially reversible | No confirmation required |
| `medium` | Standard mutation | Agent may proceed autonomously |
| `high` | Significant irreversible change | Requires confirmation gate |
| `critical` | Financial / destructive / compliance | Human review + prompt template required |

**Risk flags** that further qualify risk: `financial`, `irreversible`, `external_side_effect`, `customer_visible`, `privacy_sensitive`, `destructive`, `compliance_relevant`

---

## Devtools — Development Bridge

```mermaid
flowchart LR
    REG["AICRegistry (in-memory)"]
    BRIDGE["AICDevtoolsBridge (React component)"]
    EVENT["CustomEvent aic:devtools:snapshot (window dispatch, throttled 150ms)"]
    EXT["Browser Extension / DevTools Panel (listener)"]
    OVERLAY["AICDevtoolsOverlay (in-page inspector)"]

    REG -->|subscribe| BRIDGE
    BRIDGE -->|dispatchEvent| EVENT
    EVENT -->|listen| EXT
    REG -->|useAICInspectorSnapshot| OVERLAY
```

---

## Project Config — `aic.project.json`

```json
{
  "appName": "My App",
  "framework": "vite",
  "projectRoot": ".",
  "viewId": "vite.root",
  "viewUrl": "http://localhost:5173",
  "hmr": true,
  "notes": ["initialized by aic init"],
  "permissions": {},
  "workflows": []
}
```

This single config file drives `aic generate project` to produce all 6+ manifest artifacts.

---

## Agent Onboarding File Checklist

AIC scaffolds and tracks these files via `aic init` and `aic doctor`:

| File | Kind | Purpose |
|---|---|---|
| `AGENTS.md` | canonical | Master AIC policy for all AI agents |
| `CLAUDE.md` | wrapper | Claude Code wrapper pointing to AGENTS.md |
| `GEMINI.md` | wrapper | Gemini wrapper pointing to AGENTS.md |
| `.github/copilot-instructions.md` | copilot_instructions | GitHub Copilot AIC instructions |
| `.cursor/rules/aic.mdc` | cursor_rule | Cursor IDE rule for AIC |
| `aic.project.json` | project_config | Build-time configuration |

---

## Key Design Principles

> [!IMPORTANT]
> **Contract-first, not selector-first.** Agents use stable `agentId` values as the interaction contract, never DOM selectors or visible text.

> [!TIP]
> **Explicit over inferred.** The `authored` provenance source always wins. Add explicit `agent*` props rather than relying on DOM inference.

> [!WARNING]
> **Never hand-edit generated JSON.** All artifacts under `.well-known/` and `report.json` are generated — regenerate them with `aic generate project`.

> [!IMPORTANT]
> **Describe natively, prove independently.** Prefer native protocol fields and keep behavioral requirements, evidence, and parity in a protocol-neutral AIC contract.

> [!IMPORTANT]
> **Discover openly, decide locally.** Resolver records are portable hints. The relying party owns the policy, trust stores, trusted clock, exact target bindings, and final execution decision.

# AIC — Agent Interaction Control: Full Architecture

## System Overview

AIC is a **contract-first framework** that makes web apps reliably operable by AI agents. It does this by:

1. **Authoring** — developers annotate UI elements with stable `agent*` props
2. **Generating** — build-time tools extract those annotations into standardized JSON manifests
3. **Serving** — framework plugins expose manifests on `.well-known/` HTTP endpoints at runtime
4. **Consuming** — the MCP server exposes those manifests as tools that any AI agent can call

---

## Package Dependency Graph

```mermaid
graph TD
    subgraph SPEC["📐 @aicorg/spec — Source of Truth"]
        types["types.ts (all AIC types)"]
        authoring["authoring.ts (patch plan builder)"]
        validate["validate.ts (manifest validators)"]
        diff["diff.ts (manifest diff engine)"]
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
        writer["writeArtifactFiles"]
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
    AUTOMATION --> SPEC
    PLUGINS --> AUTOMATION
    PLUGINS --> SPEC
    CLI --> AUTOMATION
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

`@aicorg/webmcp` is a separate, feature-detected execution adapter. WebMCP supplies browser-native tool discovery and invocation; AIC supplies the authored action-readiness gate and the validation, authorization, confirmation, entity, verification, recovery, and audit behavior around it.

The adapter does not convert runtime elements or generated actions automatically. Only an explicit task-level binding backed by an authored `execution_ready` action contract can register. The human UI and tool path must call the same application/domain function.

The read-only MCP server and AIC manifests remain available for headless discovery, unsupported browsers, and consumers that need the richer AIC contract surface.

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
| `aic doctor [root] --webmcp` | Add WebMCP compatibility and governance readiness to doctor output |
| `aic validate <kind> <file>` | Validate a manifest JSON against the spec schema |
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

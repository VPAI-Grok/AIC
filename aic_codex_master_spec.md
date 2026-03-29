# AIC (Agent Interaction Contract) — Codex Master Spec

> Put this file in the project root.  
> Ask Codex to read this file first and then implement the project in phases.  
> This document is the product requirements document, architecture spec, implementation stack, package plan, schema guide, and execution roadmap for the project.

---

## 0. What this project is

Build an open standard and implementation toolkit that makes websites and web apps reliably operable by AI agents.

This project is **not** just a text file like `robots.txt`.  
It is a full system made of:

- a discovery manifest
- a runtime UI contract
- a permissions / policy manifest
- optional workflow definitions
- optional semantic action definitions
- build-time and runtime SDKs
- framework plugins
- validator / CLI
- browser devtools inspector
- AI-assisted bootstrap generation
- component-library integrations

The core idea is simple:

**A normal web app exposes DOM. An agent-ready app should expose intent, actions, entities, state, risks, completion signals, and recovery paths.**

The product name is:

**AIC = Agent Interaction Contract**

---

## 1. Why this exists

AI agents fail on real websites because current browser interaction is brittle.

Typical failure causes:

- unstable CSS selectors
- dynamic DOM changes
- hidden state
- ambiguous labels
- dropdowns loaded asynchronously
- tables reordering unexpectedly
- no stable identity for business records
- unclear completion or success signals
- no structured error taxonomy
- no indication of whether an action is destructive
- no workflow-level semantics
- no undo or rollback metadata
- no machine-readable validation rules

Existing adjacent standards are useful but incomplete for this problem:

- accessibility metadata helps with roles and state, but not full action/workflow contracts
- robots-like files are about discovery or crawl hints, not UI operation
- content guidance files are about understanding content, not controlling interfaces
- tool interoperability protocols are about external tools, not page-native UI semantics

AIC fills this gap.

---

## 2. Product vision

Create a standard plus tooling that lets any modern web app become:

- agent-discoverable
- agent-readable
- agent-operable
- agent-safe
- agent-debuggable
- agent-testable

Long-term vision:

> Any serious SaaS product, internal app, admin dashboard, commerce flow, or workflow tool can expose a robust machine-readable interaction contract to AI agents.

Short-term vision:

> Ship a TypeScript-first React/Next/Vite SDK and tooling stack that auto-generates, validates, and serves agent-readable manifests with minimal developer work.

---

## 3. Core goals

### 3.1 Functional goals

The system must:

- describe interactive elements in a machine-readable way
- support dynamic runtime state
- expose stable IDs for controls and records
- identify risk and confirmation requirements
- expose permissions and policy rules
- support workflow structure
- support deterministic action semantics
- support structured errors and recovery guidance
- support agent-safe execution
- support framework-native integrations
- support annotation-first usage
- support automatic and AI-assisted generation

### 3.2 Business goals

The project should:

- become the default "agent-ready UI" layer for web apps
- gain adoption via open-source core
- enable future commercial tooling around CI, validation, governance, observability, analytics, and enterprise controls

### 3.3 Developer experience goals

The project must be:

- easy to install
- easy to understand
- minimal-friction for frontend teams
- reviewable in PRs
- strongly typed
- framework-aware
- good for design systems
- good for high-risk workflows
- easy to inspect locally

---

## 4. Non-goals for v1

Do not try to build everything in v1.

Out of scope for first release:

- native iOS/Android SDKs
- full autonomous browser agent platform
- full computer-vision-first interaction
- every frontend framework at launch
- standards-body formalization
- universal semantic action backends for every app
- backend orchestration across arbitrary enterprise systems
- complete automatic workflow inference for any site without review

---

## 5. Product principles

These are mandatory.

### 5.1 Semantic over positional

Do not rely primarily on:

- x/y coordinates
- nth-child selectors
- brittle XPath
- screenshot-only reasoning

Use semantic metadata first.

### 5.2 Stable IDs required

Every meaningful interactive element must have a stable app-level identifier.

Examples:

- `checkout.submit_order`
- `settings.plan_selector`
- `invoice.send_button`
- `customer.archive`

### 5.3 Runtime-aware

Single-page apps mutate constantly.  
The contract must support:

- async loading
- route changes
- modals
- tabs
- lazy-loaded lists
- virtualized tables
- optimistic UI updates
- inline validation
- background jobs

### 5.4 Annotation-first, automation-friendly

Developers must be able to explicitly annotate important controls.  
The SDK should still auto-detect and auto-generate as much as possible.

### 5.5 Safe by default

High-risk actions must surface:

- risk classification
- confirmation requirements
- failure semantics
- audit expectations

### 5.6 Reviewable and debuggable

Generated output must be human-reviewable.  
AI-generated suggestions must never silently overwrite source code.

### 5.7 Separate inferred vs authored vs AI-suggested

The system must preserve provenance:

- developer-authored metadata
- plugin-inferred metadata
- AI-suggested metadata

This is critical for trust.

---

## 6. Deliverables / outputs

The system should generate or expose these artifacts.

### 6.1 Discovery manifest

Canonical path:

- `/.well-known/agent.json`

Purpose:

- tell agents AIC is supported
- declare available endpoints/files
- declare app version/spec version/capabilities

### 6.2 Runtime UI contract

Suggested endpoint:

- `/.well-known/agent/ui`

Alternative local output during dev/build:

- `agent-ui.json`

Purpose:

- expose currently rendered interactive elements
- expose state, actions, relationships, risks, entity identity, and execution hints

### 6.3 Permissions / policy manifest

Suggested file:

- `agent-permissions.json`

Purpose:

- risk bands
- confirmation rules
- forbidden actions
- audit expectations
- role-based policy
- mutation rules

### 6.4 Workflow manifest

Suggested file:

- `agent-workflows.json`

Purpose:

- describe multistep workflows
- branches
- checkpoints
- rollback/fallback steps
- human approvals

### 6.5 Semantic action manifest

Suggested file or endpoint:

- `agent-actions.json`

Purpose:

- app-level semantic actions
- structured input schemas
- safer abstraction than replaying UI clicks

### 6.6 Lightweight human-readable discovery file

Optional:

- `operate.txt`

Purpose:

- human-friendly summary
- pointer to canonical JSON files
- simple entry point for lightweight systems

Important:
`operate.txt` is useful, but **JSON manifests are the source of truth**.

---

## 7. What the system should support beyond simple clicking

AIC should go beyond "here are some buttons".

A fully agent-ready app should expose:

- what elements exist
- what actions are allowed
- what state they are in
- what business entity they operate on
- what happens if the action succeeds
- what can fail
- how to know it completed
- whether it can be undone
- whether confirmation is needed
- how to recover from failure
- what workflow step it belongs to
- what validation constraints apply

This means AIC needs more than a UI tree.  
It needs additional models:

- UI model
- action contract model
- entity model
- execution model
- recovery model
- workflow model
- policy model

---

## 8. Package architecture

Build the project as a TypeScript monorepo.

### 8.1 Required packages

- `@aicorg/spec`
- `@aicorg/runtime`
- `@aicorg/sdk-react`
- `@aicorg/plugin-next`
- `@aicorg/plugin-vite`
- `@aicorg/cli`
- `@aicorg/devtools`
- `@aicorg/ai-bootstrap`
- `@aicorg/integrations-radix`
- `@aicorg/integrations-shadcn`

### 8.2 Package responsibilities

#### `@aicorg/spec`
Contains:

- JSON schemas
- TypeScript types
- enums
- versioning rules
- manifest shape definitions

#### `@aicorg/runtime`
Contains:

- in-browser registry
- register / update / unregister APIs
- event emitter
- state tracking
- serializer
- runtime contract serving helpers

#### `@aicorg/sdk-react`
Contains:

- provider
- hooks
- wrapped primitives
- custom-component helpers
- annotation prop support
- runtime registration
- dev warnings

#### `@aicorg/plugin-next`
Contains:

- Next.js integration
- AST scanning
- annotation extraction
- build-time manifest generation
- optional data-attribute injection
- route-aware outputs

#### `@aicorg/plugin-vite`
Contains:

- Vite integration
- scan + build hooks
- HMR-aware metadata refresh
- manifest generation
- debug helpers

#### `@aicorg/cli`
Contains:

- scan
- generate
- validate
- diff
- bootstrap
- inspect
- export helpers

#### `@aicorg/devtools`
Contains:

- browser extension
- overlay inspector
- metadata editor
- export panel
- runtime visualizer

#### `@aicorg/ai-bootstrap`
Contains:

- Playwright crawler
- DOM/accessibility/screenshot collection
- LLM inference pipeline
- draft manifest generation
- patch suggestion generation

#### `@aicorg/integrations-radix`
Contains:

- adapters/wrappers for Radix primitives
- role/state/action inference
- trigger-content relationship mapping

#### `@aicorg/integrations-shadcn`
Contains:

- shadcn-friendly wrappers
- low-friction AIC props
- Tailwind-safe integration patterns

---

## 9. Recommended repo structure

```text
aic/
  apps/
    docs/
    playground-next/
    devtools-extension/
  packages/
    spec/
    runtime/
    sdk-react/
    plugin-next/
    plugin-vite/
    cli/
    devtools/
    ai-bootstrap/
    integrations-radix/
    integrations-shadcn/
  examples/
    nextjs-checkout-demo/
    nextjs-dashboard-demo/
    vite-crm-demo/
  schemas/
    agent.schema.json
    agent-ui.schema.json
    agent-permissions.schema.json
    agent-workflows.schema.json
    agent-actions.schema.json
  docs/
    architecture.md
    manifest-spec.md
    sdk-api.md
    threat-model.md
    implementation-phases.md
  package.json
  pnpm-workspace.yaml
  turbo.json
  README.md
  AIC_Codex_Master_Spec.md
```

---

## 10. Developer API design

The first-class approach is **annotation-first** with automatic inference and generation around it.

### 10.1 Basic React example

```tsx
<Button
  agentId="checkout.submit_order"
  agentDescription="Completes purchase and charges the selected payment method"
  agentAction="submit"
  agentRisk="critical"
  agentRequiresConfirmation
>
  Complete purchase
</Button>
```

### 10.2 More complete example

```tsx
<AIC.Button
  agentId="invoice.send"
  agentDescription="Sends the invoice to the selected customer email"
  agentRisk="high"
  agentEffects={["invoice.status=sent", "email.dispatch"]}
  agentRequiresConfirmation
  agentWorkflowStep="send_invoice.confirm_send"
  agentEntityType="invoice"
  agentEntityId={invoice.id}
>
  Send invoice
</AIC.Button>
```

### 10.3 Props to support in v1

Supported props:

- `agentId`
- `agentDescription`
- `agentAction`
- `agentRisk`
- `agentRequiresConfirmation`
- `agentAliases`
- `agentEffects`
- `agentPermissions`
- `agentWorkflowStep`
- `agentEntityType`
- `agentEntityId`
- `agentNotes`
- `agentExamples`

### 10.4 Props to support in v2

Add support for:

- `agentPreconditions`
- `agentPostconditions`
- `agentFailureModes`
- `agentCompletionSignal`
- `agentUndoable`
- `agentUndoAction`
- `agentBatchConfig`
- `agentValidation`
- `agentRecovery`
- `agentHumanConfirmation`

---

## 11. Data attributes

The SDK/plugins should support injecting data attributes where useful.

### 11.1 Required/important data attributes

- `data-agent-id`
- `data-agent-description`
- `data-agent-action`
- `data-agent-risk`
- `data-agent-role`
- `data-agent-confirmation`
- `data-agent-workflow`
- `data-agent-entity-type`
- `data-agent-entity-id`

### 11.2 Notes

- data attributes are useful for runtime inspection and fallback automation
- they are not the only contract surface
- the runtime registry remains the authoritative source for live state

---

## 12. Generation modes

The system must support multiple generation modes.

### 12.1 Build-time generation

Build-time generation should:

- scan source files
- parse JSX/TSX/AST
- identify interactive elements
- extract annotation props
- infer metadata where possible
- generate static manifests
- optionally inject data attributes

Use cases:

- CI
- manifest generation for deployment
- codebase linting
- PR review

### 12.2 Runtime generation

Runtime generation should:

- register elements at mount time
- update state on change
- unregister on unmount
- expose live UI tree
- capture async state and visibility
- connect controls to entities/workflows

Use cases:

- dynamic apps
- SPA state
- modals
- virtualized lists
- real-time inspection

### 12.3 Hybrid mode (default recommended)

Recommended production mode:

- build-time scanning creates baseline manifests
- runtime registry adds live state and dynamic context
- manual annotations override inference
- AI bootstrap suggests missing metadata
- human reviews final output

### 12.4 AI-assisted bootstrap mode

Use Playwright + LLM to:

- crawl pages
- detect controls
- observe behavior
- infer action labels/risk/workflow/entity relationships
- generate draft YAML/JSON
- suggest code annotations
- require human review before merge

Important:

AI-assisted mode is a bootstrap and migration tool, not the sole source of truth.

---

## 13. Detection strategy

Codex should implement layered detection.

### 13.1 Detection priority order

1. explicit developer annotation
2. integration-specific knowledge (Radix / shadcn / known components)
3. HTML semantics
4. ARIA role/state hints
5. event handlers
6. runtime behavior observation
7. AI-assisted inference

### 13.2 Interactive element detection targets

Detect at minimum:

- button
- link-as-button
- input
- textarea
- searchbox
- select
- option
- checkbox
- radio
- switch
- tab
- tabpanel
- menu
- menuitem
- dialog trigger
- dialog
- form
- submit button
- upload control
- contenteditable
- grid / rows / cells
- listbox / combobox

### 13.3 Heuristics to implement

Examples:

- element with `onClick` + clear label => actionable click target
- submit button inside checkout form => likely high-risk
- text includes "delete", "remove", "purchase", "pay", "submit order" => suggest elevated risk
- element associated with entity row => attach entity metadata if available
- dropdown component from known library => infer combobox/listbox/options relationship

---

## 14. Core manifest set

### 14.1 `/.well-known/agent.json`

This is the discovery entrypoint.

Required fields:

- `spec`
- `app.name`
- `app.version`
- `capabilities`
- `endpoints`

Recommended fields:

- `framework`
- `generated_at`
- `manifest_version`
- `compatibility`
- `notes`

Example:

```json
{
  "spec": "aic/0.1",
  "app": {
    "name": "Demo Checkout",
    "version": "1.0.0"
  },
  "capabilities": {
    "runtimeUiTree": true,
    "semanticActions": true,
    "workflows": true,
    "permissions": true,
    "events": true,
    "actionContracts": true,
    "entityModel": true,
    "executionModel": true,
    "recoveryModel": true
  },
  "endpoints": {
    "ui": "/.well-known/agent/ui",
    "actions": "/.well-known/agent/actions",
    "permissions": "/.well-known/agent-permissions.json",
    "workflows": "/.well-known/agent-workflows.json"
  }
}
```

---

## 15. Runtime UI model

The UI model represents the live interactive tree.

### 15.1 Top-level fields

- `spec`
- `page`
- `view`
- `user_context`
- `elements`
- `relationships`
- `updated_at`

### 15.2 Page/view metadata

Example fields:

- `url`
- `title`
- `view_id`
- `route_pattern`
- `updated_at`
- `navigation_context`

### 15.3 Element fields

Required:

- `id`
- `role`
- `label`
- `state`
- `actions`
- `risk`

Recommended:

- `description`
- `parent_id`
- `children`
- `aliases`
- `effects`
- `constraints`
- `selectors`
- `entity_ref`
- `workflow_ref`
- `notes`
- `permissions`

### 15.4 Example element

```json
{
  "id": "billing.save_button",
  "role": "button",
  "label": "Save changes",
  "description": "Persists billing settings",
  "state": {
    "visible": true,
    "enabled": true,
    "busy": false
  },
  "actions": [
    { "name": "click" }
  ],
  "risk": "medium",
  "entity_ref": null
}
```

---

## 16. Action contract model (new, high priority)

This is one of the most important additions.

A simple action name is not enough.  
The app should expose deterministic action semantics.

### 16.1 Why this matters

Agents need to know:

- what must be true before acting
- what changes if action succeeds
- what side effects happen
- whether it is idempotent
- whether it is undoable
- how long it usually takes
- how to know it completed
- what can fail
- whether partial mutation may occur

### 16.2 Required fields for high-value actions

- `name`
- `title`
- `target`
- `preconditions`
- `postconditions`
- `side_effects`
- `idempotent`
- `undoable`
- `estimated_latency_ms`
- `completion_signal`
- `failure_modes`

### 16.3 Example

```json
{
  "name": "checkout.submit_order",
  "title": "Submit order",
  "target": "checkout.submit_order",
  "preconditions": [
    "cart.items_count > 0",
    "payment_method.valid = true"
  ],
  "postconditions": [
    "order.status = submitted"
  ],
  "side_effects": [
    "charge.payment_method",
    "create.order"
  ],
  "idempotent": false,
  "undoable": false,
  "estimated_latency_ms": 4000,
  "completion_signal": {
    "type": "toast_or_navigation",
    "value": "Order placed"
  },
  "failure_modes": [
    "payment_declined",
    "inventory_changed",
    "session_expired"
  ]
}
```

### 16.4 What Codex should implement

- a JSON schema for action contracts
- action contract references from elements and workflows
- helper props for component-level annotations
- runtime surface for completion and failure state
- validator rules for required fields on high-risk actions

---

## 17. Entity model (new, high priority)

Stable element IDs are not enough.  
Agents also need stable identity for the business object being acted on.

### 17.1 Why this matters

If an agent clicks "row 2 send invoice" and the table reorders, the wrong invoice may be sent.

The contract must support stable business identity.

### 17.2 Required concepts

- `entity_type`
- `entity_id`
- `entity_label`
- `backing_resource`
- `row_key`
- `parent_entity_id`

### 17.3 Example

```json
{
  "id": "invoice.row.send_button",
  "role": "button",
  "label": "Send",
  "entity_ref": {
    "entity_type": "invoice",
    "entity_id": "inv_10482",
    "backing_resource": "/api/invoices/inv_10482"
  }
}
```

### 17.4 Table/grid requirements

Rows should be able to carry:

- stable row key
- entity type
- entity id
- row actions
- selected state

### 17.5 What Codex should implement

- `entity_ref` support in UI model
- entity metadata in row/list/card components
- helper API to bind component metadata to domain entities
- validator rules warning when row actions have no entity identity

---

## 18. Execution model (new, high priority)

Execution state is a major source of agent failure.

### 18.1 Why this matters

Agents need to know:

- when something is loading
- when something is ready
- when the UI is stale
- when background work is still running
- when retry is safe
- whether a long-running job needs polling

### 18.2 Model fields

For views, elements, and actions support:

- `ready_when`
- `busy_when`
- `settled_when`
- `invalidation_triggers`
- `async_job_id`
- `poll_endpoint`
- `estimated_latency_ms`
- `retry_after_ms`

### 18.3 Example

```json
{
  "execution": {
    "ready_when": ["validation.complete = true"],
    "busy_when": ["form.submitting = true"],
    "settled_when": ["toast.visible = true", "button.busy = false"]
  }
}
```

### 18.4 Long-running job example

```json
{
  "execution": {
    "async_job_id": "job_123",
    "poll_endpoint": "/api/jobs/job_123",
    "ready_when": ["job.status = completed"]
  }
}
```

### 18.5 What Codex should implement

- execution metadata schema
- runtime support for busy/ready/settled flags
- optional polling helper interfaces
- action/event linkage for async completion

---

## 19. Recovery model (new, high priority)

Agents need structured ways to handle failure.

### 19.1 Why this matters

Toasts and raw strings are not enough.  
Errors should be structured and machine-readable.

### 19.2 Error taxonomy

Support codes such as:

- `validation_error`
- `permission_denied`
- `network_timeout`
- `conflict`
- `rate_limited`
- `session_expired`
- `resource_locked`
- `transient_backend_failure`
- `partial_mutation`
- `dependency_failed`

### 19.3 Recovery fields

- `error_code`
- `retryable`
- `retry_after_ms`
- `recovery`
- `human_escalation_required`
- `partial_state_changed`

### 19.4 Example

```json
{
  "error_code": "resource_locked",
  "retryable": true,
  "retry_after_ms": 5000,
  "recovery": "refresh_entity_and_retry",
  "partial_state_changed": false
}
```

### 19.5 What Codex should implement

- recovery schema
- failure mode references from action contracts
- validator for missing failure metadata on high-risk actions
- runtime event surface for action failed / action completed

---

## 20. Workflow model

Workflows should not be just simple linear lists.

### 20.1 Why this matters

Real app tasks involve:

- branches
- retries
- checkpoints
- human approvals
- rollback paths
- alternate steps

### 20.2 Required workflow fields

- `id`
- `title`
- `entry_points`
- `preconditions`
- `steps`
- `completion_signal`

### 20.3 Recommended workflow fields

- `branches`
- `fallback_steps`
- `rollback_steps`
- `checkpoint_steps`
- `human_approval_steps`
- `retryable_steps`
- `estimated_duration_ms`

### 20.4 Example

```json
{
  "id": "create_invoice",
  "title": "Create and send invoice",
  "entry_points": ["/invoices/new"],
  "preconditions": ["user.role in ['admin','billing_manager']"],
  "steps": [
    {
      "id": "open_form",
      "type": "element_action",
      "target": "invoice.new_button",
      "action": "click"
    },
    {
      "id": "set_customer",
      "type": "semantic_action",
      "action": "invoice.set_customer"
    },
    {
      "id": "send_invoice",
      "type": "semantic_action",
      "action": "invoice.send",
      "requires_confirmation": true
    }
  ],
  "checkpoint_steps": ["set_customer"],
  "completion_signal": {
    "type": "toast",
    "value": "Invoice sent"
  }
}
```

---

## 21. Policy / permissions model

This must be first-class.

### 21.1 Why this matters

Agents must know what is allowed, risky, forbidden, or approval-gated.

### 21.2 Required concepts

- risk bands
- confirmation rules
- role requirements
- forbidden actions
- audit requirements
- mutation policy
- batch policy
- reauth requirements

### 21.3 Example

```json
{
  "version": "0.1",
  "riskBands": {
    "low": { "requiresConfirmation": false },
    "medium": { "requiresConfirmation": false },
    "high": { "requiresConfirmation": true },
    "critical": { "requiresConfirmation": true }
  },
  "actionPolicies": {
    "checkout.submit_order": {
      "risk": "critical",
      "requiresConfirmation": true,
      "audit": true
    }
  },
  "forbiddenActions": [
    "user.delete_owner_account"
  ]
}
```

---

## 22. Human confirmation protocol

A boolean `requires_confirmation` is useful but insufficient.

### 22.1 Add these fields

- `confirmation.type`
- `confirmation.prompt_template`
- `confirmation.summary_fields`
- `confirmation.expires_in_seconds`
- `confirmation.reusable_for_batch`
- `confirmation.requires_manual_phrase`

### 22.2 Example

```json
{
  "requires_confirmation": true,
  "confirmation": {
    "type": "human_review",
    "prompt_template": "Send invoice {{invoice_id}} to {{customer_email}} for {{amount}}?",
    "expires_in_seconds": 300,
    "reusable_for_batch": false
  }
}
```

### 22.3 What Codex should implement

- confirmation schema
- validator requiring richer confirmation details on critical actions
- devtools rendering for confirmation previews

---

## 23. Input validation model

Agents should know exactly what valid input looks like.

### 23.1 Validation fields

- `required`
- `format`
- `pattern`
- `min_length`
- `max_length`
- `minimum`
- `maximum`
- `enum`
- `server_unique`
- `examples`
- `cross_field_dependencies`

### 23.2 Example

```json
{
  "id": "customer.email",
  "validation": {
    "required": true,
    "format": "email",
    "max_length": 255,
    "server_unique": true,
    "examples": ["name@example.com"]
  }
}
```

### 23.3 What Codex should implement

- validation schema
- field-level validation mapping
- plugin inference from HTML attributes and component props
- warnings for missing validation on required fields

---

## 24. Risk model extension

Low/medium/high/critical is useful, but add more dimensions.

### 24.1 Risk flags

Actions should support flags like:

- `financial`
- `irreversible`
- `external_side_effect`
- `customer_visible`
- `privacy_sensitive`
- `destructive`
- `compliance_relevant`

### 24.2 Example

```json
{
  "risk": "high",
  "risk_flags": [
    "financial",
    "customer_visible",
    "external_side_effect"
  ]
}
```

### 24.3 What Codex should implement

- risk enum + risk flag arrays
- validator rules for confirmation recommendations
- AI bootstrap inference hints for risky verbs

---

## 25. Dry-run / simulation support

This is a valuable feature for safer agents.

### 25.1 Use cases

- preview invoice send
- preview subscription cost change
- preview affected records count
- preview email recipients
- preview delete/archive scope

### 25.2 Suggested fields

- `supports_dry_run`
- `dry_run_action`
- `preview_fields`
- `simulation_limitations`

### 25.3 What Codex should implement

- model support in action contracts
- devtools display support
- examples in demo apps
- validator hints for high-risk actions without preview/undo

---

## 26. Undo / rollback support

AIC should explicitly represent reversibility.

### 26.1 Fields

- `undoable`
- `undo_window_seconds`
- `undo_action`
- `rollback_strategy`

### 26.2 Example

```json
{
  "undoable": true,
  "undo_window_seconds": 30,
  "undo_action": "invoice.unsend",
  "rollback_strategy": "restore_previous_status"
}
```

### 26.3 What Codex should implement

- schema support
- validator awareness
- demo examples
- workflow rollback links

---

## 27. Batch action support

Agents often operate on many items at once.

### 27.1 Fields

- `batch.supported`
- `batch.max_items`
- `batch.mode`
- `batch.per_item_results`
- `batch.concurrency_limit`

### 27.2 Example

```json
{
  "batch": {
    "supported": true,
    "max_items": 100,
    "mode": "partial_success",
    "per_item_results": true
  }
}
```

### 27.3 What Codex should implement

- batch schema
- row/table integrations
- validation for batch actions with missing max limits

---

## 28. Table/grid/list semantics

This is a common source of agent errors and should be first-class.

### 28.1 Required capabilities

For grids/lists/tables, expose:

- columns
- row identity
- sortability
- filterability
- searchability
- pagination
- virtualization
- selection model
- row actions
- total count

### 28.2 Example

```json
{
  "id": "invoice.table",
  "role": "grid",
  "label": "Invoices",
  "state": {
    "row_count": 42,
    "virtualized": true
  },
  "columns": [
    { "key": "invoice_number", "label": "Invoice #" },
    { "key": "customer_name", "label": "Customer" },
    { "key": "status", "label": "Status" }
  ],
  "selection_model": "multi"
}
```

### 28.3 What Codex should implement

- special handling for grids
- row entity binding
- action-to-row/entity mapping
- runtime serialization helpers

---

## 29. File interaction semantics

Agents often upload or download files.

### 29.1 Upload fields

- `accepted_types`
- `max_size_mb`
- `scan_required`
- `processing_delay_expected`
- `parsed_output_ref`

### 29.2 Download fields

- `available_formats`
- `generation_delay_expected`
- `completion_signal`

### 29.3 What Codex should implement

- upload/download metadata models
- demo flows
- devtools visualization

---

## 30. Session/authentication awareness

Expose meaningful auth/session state.

### 30.1 Fields

- `session_expires_at`
- `reauth_required_for`
- `mfa_required`
- `active_scopes`
- `current_user_role`
- `impersonation_mode`

### 30.2 Why this matters

Prevents mysterious failures and supports safer action planning.

---

## 31. Observability and audit model

The system should be debug-friendly.

### 31.1 Useful concepts

- action trace ID
- correlation ID
- mutation log
- before/after snapshot references
- agent-origin flag
- audit-required flag

### 31.2 What Codex should implement

- optional trace metadata support
- runtime event hooks
- example logging interfaces
- validator rules where appropriate

---

## 32. Confidence / ambiguity metadata

This is useful especially for auto-generated and AI-assisted metadata.

### 32.1 Fields

- `confidence_score`
- `ambiguity_notes`
- `requires_human_review_if_below`

### 32.2 Use cases

- AI bootstrap output
- uncertain risk classification
- unclear entity matching
- label ambiguity

### 32.3 What Codex should implement

- provenance model for metadata
- confidence support in AI bootstrap output
- devtools review UI

---

## 33. Localization-safe metadata

Labels change across languages.  
IDs must not.

### 33.1 Rules

- `agentId` must be language-independent
- display labels may be localized
- semantic meaning should remain stable across locales

### 33.2 What Codex should implement

- enforce ID independence from localized display strings where possible
- support localized labels + canonical IDs in schemas

---

## 34. Versioning / compatibility model

This must be explicit.

### 34.1 Required fields

- `spec_version`
- `manifest_version`
- `app_version`
- `generated_at`
- `compatibility.minimum_agent_version`
- `deprecated_fields`

### 34.2 What Codex should implement

- version constants in spec package
- upgrade-safe schema design
- compatibility documentation

---

## 35. AI-assisted bootstrap system

This is a major product feature and must be included.

### 35.1 Goals

Let developers generate an initial draft of manifests/annotations using automated browsing and LLM inference.

### 35.2 Pipeline

1. Launch target app in Playwright
2. Crawl configured routes/pages
3. Capture:
   - HTML / DOM
   - accessibility tree
   - screenshots
   - visible labels
   - form structures
   - route transitions
   - click traces
4. Feed structured page summaries to an LLM
5. Generate:
   - draft discovery manifest
   - draft runtime-like static manifest
   - draft permissions/risk hints
   - draft workflows
   - draft action contracts
   - draft entity relationships
6. Produce:
   - JSON/YAML manifests
   - confidence scores
   - ambiguity notes
   - source patch suggestions

### 35.3 Important behavior rules

The AI bootstrap must:

- never silently modify app code
- produce suggestions and diffs
- separate inferred vs AI-suggested fields
- require human review
- generate uncertainty reports

### 35.4 CLI command shape

Suggested commands:

```bash
aic bootstrap http://localhost:3000
aic bootstrap http://localhost:3000 --routes /checkout,/settings,/invoices
aic bootstrap http://localhost:3000 --output ./aic-drafts
```

---

## 36. Browser devtools extension / inspector

This is required for local adoption and debugging.

### 36.1 Must-have capabilities

- highlight interactive elements
- show current AIC metadata
- inspect runtime state
- edit metadata
- assign stable IDs
- flag missing required fields
- export manifest snippets
- compare authored vs inferred vs AI-suggested metadata

### 36.2 Nice-to-have capabilities

- record workflow sequence
- record action timing
- preview confirmation prompts
- inspect entity bindings
- inspect trace/recovery metadata

### 36.3 What Codex should implement

- browser extension skeleton
- overlay highlighter
- React panel UI
- export button
- local runtime connection

---

## 37. Framework plugins

### 37.1 Next.js plugin requirements

The Next.js plugin should:

- support React/Next first
- scan routes/components
- extract annotation props
- generate manifests during build
- optionally inject data attributes
- support app router
- support pages router if feasible
- emit `.well-known` files
- provide dev-time warnings
- optionally surface a local debug endpoint

### 37.2 Vite plugin requirements

The Vite plugin should:

- scan source in dev/build
- support HMR-aware metadata refresh
- generate manifests
- expose local debug endpoints if useful
- initially target React
- later permit Vue/Svelte adapters

---

## 38. React SDK

This is the first framework SDK and must be excellent.

### 38.1 Core exports

- `AICProvider`
- `useAICRegistry`
- `useAICElement`
- `createAICComponent`
- wrapped primitives like:
  - `AIC.Button`
  - `AIC.Input`
  - `AIC.Select`
  - `AIC.Dialog`
  - `AIC.Form`
  - `AIC.Table`

### 38.2 Responsibilities

- register on mount
- update on state changes
- unregister on unmount
- merge authored metadata with inferred metadata
- bind to entity metadata where provided
- bind to workflow/action contract metadata where provided
- expose development-time warnings for missing critical fields

### 38.3 Example

```tsx
<AIC.Select
  agentId="subscription.plan"
  agentDescription="Changes the customer's subscription plan"
  agentRisk="high"
  agentEntityType="subscription"
  agentEntityId={subscription.id}
  options={[
    { value: "starter", label: "Starter" },
    { value: "pro", label: "Pro" }
  ]}
/>
```

---

## 39. Component library integrations

### 39.1 Radix integration

Need adapters for:

- dropdowns
- dialogs
- popovers
- tabs
- selects
- menus
- switches
- checkboxes

Responsibilities:

- infer roles and state
- link triggers to content
- capture open/closed state
- expose items/options/actions

### 39.2 shadcn integration

Need wrappers that:

- preserve current DX
- support Tailwind styling
- add agent props naturally
- auto-register key component primitives

### 39.3 Design goal

A developer using shadcn or Radix should need minimal extra annotation for common controls.

---

## 40. CLI requirements

### 40.1 Commands

Implement these first:

- `aic scan`
- `aic generate`
- `aic validate`
- `aic diff`
- `aic bootstrap`
- `aic inspect`

### 40.2 Command responsibilities

#### `aic scan`
Analyze source and report candidate elements/annotations.

#### `aic generate`
Generate manifests/files.

#### `aic validate`
Validate manifests and code-level annotations against rules.

#### `aic diff`
Compare generated output across commits/builds.

#### `aic bootstrap`
Run Playwright + LLM draft generation.

#### `aic inspect`
Open or connect to local runtime metadata inspector.

---

## 41. Validation and linting rules

The validator should catch:

- duplicate IDs
- missing descriptions on high-risk actions
- missing confirmation details on critical actions
- invalid role/action combinations
- elements with row actions but no entity identity
- missing validation metadata on key input fields
- invalid workflow references
- permissions for nonexistent actions
- unreviewed low-confidence AI suggestions in protected paths
- build-time/runtime contract mismatches
- unstable auto-generated IDs
- missing completion signals on async actions
- high-risk actions with no failure metadata
- batch actions with no max size
- upload controls with no type/size metadata

### 41.1 Severity levels

Support:

- `info`
- `warning`
- `error`
- `fatal`

### 41.2 Configurability

Allow project config to define:

- protected routes
- required metadata for certain risk levels
- custom risk terms
- forbidden words or patterns
- CI fail thresholds

---

## 42. Technical stack

Keep the implementation boring, explicit, and strong.

### 42.1 Monorepo

- `pnpm`
- `turborepo`

### 42.2 Language

- TypeScript everywhere

### 42.3 App/framework targets

- React
- Next.js
- Vite
- later Vue/Svelte

### 42.4 AST / transform tooling

Choose from:

- Babel
- SWC
- TypeScript compiler API
- `ts-morph`
- `recast`

Recommended:
- `ts-morph` or TS compiler API for code-aware extraction/codemods
- Babel/SWC only where plugin ergonomics matter

### 42.5 Runtime and validation

- small event emitter
- optional MutationObserver
- AJV for JSON Schema validation
- Zod for developer-facing runtime typing

### 42.6 AI bootstrap

- Playwright
- LLM provider abstraction
- structured JSON output enforcement
- screenshot/DOM/accessibility capture pipeline

### 42.7 Testing

- Vitest
- Playwright
- React Testing Library

### 42.8 Docs

- Docusaurus or Next.js docs app

---

## 43. Implementation phases for Codex

Codex should implement in this order.

### Phase 1 — Spec foundation

Build:

- schema definitions
- TS types
- enums
- version constants
- manifest examples

Deliverables:

- `@aicorg/spec`
- schemas for:
  - discovery
  - runtime UI
  - permissions
  - workflows
  - actions
  - action contracts
  - entity model fragments
  - execution/recovery fragments

### Phase 2 — Runtime registry

Build:

- registry
- register/update/unregister APIs
- serialization
- runtime events
- provenance tracking
- busy/ready state support

Deliverables:

- `@aicorg/runtime`

### Phase 3 — React SDK

Build:

- provider
- hooks
- wrapped primitives
- annotation support
- entity support
- validation support
- dev warnings

Deliverables:

- `@aicorg/sdk-react`

### Phase 4 — Build plugins

Build:

- Next plugin
- Vite plugin
- AST extraction
- baseline manifest generation
- `.well-known` outputs
- data-attribute injection

Deliverables:

- `@aicorg/plugin-next`
- `@aicorg/plugin-vite`

### Phase 5 — CLI

Build:

- scan/generate/validate/diff/bootstrap/inspect

Deliverables:

- `@aicorg/cli`

### Phase 6 — Devtools

Build:

- extension shell
- overlay
- metadata viewer/editor
- export capability

Deliverables:

- `@aicorg/devtools`

### Phase 7 — AI bootstrap

Build:

- Playwright crawler
- inference pipeline
- draft manifest generator
- patch suggestion generator
- confidence scoring

Deliverables:

- `@aicorg/ai-bootstrap`

### Phase 8 — Integrations and demos

Build:

- Radix integration
- shadcn integration
- 2–3 example apps

Deliverables:

- `@aicorg/integrations-radix`
- `@aicorg/integrations-shadcn`
- examples/

---

## 44. Codex implementation rules

These are important. Codex should follow them strictly.

### Rule 1
Do not hardcode only React component names as the sole detection strategy.

### Rule 2
Always prefer explicit annotations over inference.

### Rule 3
Never silently overwrite source code from AI-assisted mode.

### Rule 4
Preserve provenance:
- authored
- inferred
- ai_suggested

### Rule 5
The runtime registry is the source of truth for live dynamic state.

### Rule 6
Generated IDs must be stable and semantic whenever possible.

Bad:
- `button_17`

Better:
- `checkout.submit_order`

### Rule 7
High-risk and critical actions require richer metadata than low-risk actions.

### Rule 8
Entity identity should be treated as first-class, not optional for tables/rows/cards.

### Rule 9
If completion is asynchronous, the contract must expose how to know when the action has settled.

### Rule 10
Validation and recovery metadata are required for serious production use cases.

---

## 45. Example developer workflows

### Workflow A — Manual annotation

Developer adds props to important components.  
Build plugin extracts annotations.  
Runtime registry tracks live state.

### Workflow B — Mostly automatic

Developer installs plugin.  
Plugin scans app and generates manifests.  
Developer reviews warnings and fixes critical gaps.

### Workflow C — AI bootstrap

Developer runs bootstrap command.  
System crawls the app and generates draft manifests and patch suggestions.  
Developer reviews and commits approved results.

### Workflow D — Devtools-assisted

Developer opens browser extension.  
Highlights elements, assigns IDs/descriptions, exports metadata.

---

## 46. MVP definition

The MVP should include:

- schemas
- TypeScript types
- runtime registry
- React SDK
- Next.js plugin
- Vite plugin
- CLI
- devtools inspector
- AI bootstrap
- `/.well-known/agent.json` generation
- runtime UI generation
- `agent-permissions.json` generation
- `operate.txt` generation
- entity support for rows/cards
- action contract support for important actions
- validation and recovery schema support
- Radix/shadcn starter integrations
- 2 demo apps

---

## 47. Nice-to-have after MVP

- Vue plugin
- Svelte plugin
- MCP bridge
- OpenAPI bridge
- workflow recorder
- CI GitHub Action
- hosted policy manager
- observability dashboard
- replay debugger
- enterprise governance console

---

## 48. Success metrics

Measure:

- reduction in automation failures
- reduction in selector breakage across deploys
- percentage of interactive controls with stable IDs
- percentage of row actions bound to stable entity IDs
- percentage of high-risk actions with confirmation metadata
- percentage of async actions with completion signals
- percentage of key forms with validation metadata
- time to onboard app to AIC
- dev annotation burden
- manifest accuracy over time
- agent task completion rate
- reduction in wrong-record actions

---

## 49. Key risks and mitigations

### Technical risks

- AST scanning complexity
- hidden semantics in custom components
- dynamic state drift between runtime and build-time output
- noisy inference for action meaning/risk
- framework-specific edge cases

### Product risks

- too much manual work
- too much noisy automation
- unclear naming/spec boundaries
- poor DX for design-system users

### Mitigations

- ship hybrid approach
- annotation-first for critical paths
- AI bootstrap only as helper
- strong devtools review loop
- strong validator
- good examples and starter integrations

---

## 50. Immediate first build targets

Codex should start with these concrete implementation tasks:

1. initialize monorepo with `pnpm` + `turborepo`
2. create `@aicorg/spec` with versioned JSON schemas
3. create `@aicorg/runtime` with registry and event model
4. create `@aicorg/sdk-react` with provider + button/input/select wrappers
5. create sample `/.well-known/agent.json` generator
6. create `agent-permissions.json` + `operate.txt` generation
7. create validator rules for:
   - duplicate IDs
   - missing critical metadata
   - missing entity IDs on row actions
8. create a Next.js example app
9. create a Vite example app
10. create basic devtools overlay
11. create bootstrap crawler skeleton with Playwright
12. create Radix + shadcn starter wrappers

---

## 51. Final positioning

Position the product as:

**Open contract and tooling for making web apps reliably operable by AI agents.**

Not as:

- just another metadata text file
- just browser automation
- just DOM inspection
- just accessibility
- just content guidance
- just test automation

This is a new layer:

**Agent-ready interaction semantics for modern applications.**

---

## 52. Slogan / mental model

### Slogan
**Expose what the page means, not what the DOM looks like.**

### Mental model
A typical website says:

> Here are some DOM nodes. Good luck.

An AIC-enabled app says:

> Here are the tasks, entities, actions, risks, validation rules, completion signals, and recovery paths.

---

## 53. Direct checklist of ideas that must be included

This project must include all of the following:

- SDK/framework that auto-generates files/manifests
- runtime generation
- build-time generation
- component tree / AST scanning
- auto-detection of interactive elements
- `data-agent-id` / `data-agent-description` / `data-agent-action`
- generation of `operate.txt`
- generation of `agent-permissions.json`
- annotation-first component API
- AI-assisted crawl mode via Playwright + LLM
- human review before commit
- Next.js plugin
- Vite plugin
- browser devtools extension
- highlight/export/edit manifest
- shadcn integration
- Radix integration
- auto-register dropdowns and other primitives
- action contracts
- entity model
- execution model
- recovery model
- workflow graph support
- validation metadata
- structured error taxonomy
- human confirmation protocol
- dry-run/simulation support
- undo/rollback support
- batch action semantics
- table/grid semantics
- session/auth awareness
- confidence/ambiguity/provenance metadata
- localization-safe IDs
- versioning and compatibility rules

---

## 54. Instruction to Codex

Read this file fully before making architectural decisions.

Then implement in phases exactly as described above.

Prioritize:

1. correctness of the core spec
2. clean package boundaries
3. React-first developer experience
4. explicit provenance
5. runtime registry quality
6. good validation rules
7. inspectability and reviewability

Do not over-optimize early.  
Do not invent unnecessary abstractions beyond what this document requires.  
Prefer clear, typed, well-documented modules over cleverness.

When in doubt, optimize for:

- stability
- safety
- reviewability
- developer adoption
- agent reliability

---

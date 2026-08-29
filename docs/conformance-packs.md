# AIC Conformance Packs

Conformance packs define reusable obligations for classes of consequential application operations. They do not infer an application's behavior and they never turn a generated contract into an executable tool.

## Built-in packs

| Pack | Profiles | Purpose |
|---|---|---|
| `aic.pack.checkout` | `complete` | Exact order scope, authorization, confirmation, idempotent charge, failure isolation, audit, and recovery |
| `aic.pack.billing-mutation` | `mutate` | Monetary and account scope, provider idempotency, receipts, and reconciliation |
| `aic.pack.account-deletion` | `delete` | Fresh authorization, destructive confirmation, tenant isolation, audit, and partial-cleanup recovery |
| `aic.pack.admin-mutation` | `mutate` | Role and tenant scope, exact target, immutable audit, and rollback or retry |
| `aic.pack.record-crud` | `create`, `read`, `update`, `delete` | Record-level scope and authorization with operation-appropriate mutation and recovery rules |

List or inspect the exact versioned JSON:

```bash
aic conformance list
aic conformance show aic.pack.checkout
```

## Authored bindings

Pack obligation IDs are intentionally generic. An application owner must explicitly map them to real behavior requirement IDs, scenario IDs, and human/agent surface IDs. A binding contains `authored: true` and canonical pack and contract digests. A stale contract or changed pack therefore invalidates the binding.

The mapping file has three fields. This abridged shape shows the key names; an incomplete mapping fails verification. Use the [checkout mapping](../examples/nextjs-checkout-demo/aic-conformance-mapping.json) as the complete reference.

```json
{
  "requirement_map": {
    "exact_scope": ["checkout.exact_scope"],
    "authorization_allowed": ["authorization.allowed"],
    "authorization_denied": ["authorization.denied"]
  },
  "scenario_map": {
    "success": ["success"],
    "authorization_denial": ["authorization-denied"]
  },
  "surface_roles": {
    "human": ["human-ui"],
    "agent": ["webmcp"]
  }
}
```

Generate and verify the binding:

```bash
aic conformance bind aic.pack.checkout complete \
  ./aic-behavior-contract.json ./aic-conformance-mapping.json \
  --out-file ./aic-conformance-binding.json

aic conformance verify aic.pack.checkout \
  ./aic-conformance-binding.json ./aic-behavior-contract.json \
  --proof ./aic-proof.json \
  --out-file ./aic-conformance-result.json
```

Contract-level verification checks mappings, phases, scenario semantics, and surface roles. Proof-level verification additionally requires the mapped scenarios and required parity to pass. Missing business-failure or recovery evidence is a failure, not partial certification.

## Claim language

Say that an exact contract and proof passed a named pack ID, profile, version, and digest at a recorded time. Do not shorten that to "AIC certified" unless a separate, disclosed certification program actually performed an audit.

# Protocol Evidence and Remote Observation

AIC evidence adapters convert protocol-specific execution into the same `aic_behavior_observation_set` used by the behavior verifier. They do not redefine WebMCP, MCP, HTTP, or OpenAPI.

## Packages

- `@aicorg/evidence-core` validates authored plans, evaluates strict projections, creates digest-addressed JSON artifacts, merges observations, and verifies bundle bindings.
- `@aicorg/evidence-http` executes same-origin HTTP requests and resolves a unique OpenAPI `operationId` from OpenAPI 3.2, 3.1, or 3.0 documents.
- `@aicorg/evidence-mcp` supports the stateless MCP `2026-07-28` HTTP wire format and an injected caller for controlled transports such as stdio.
- `@aicorg/runner-remote` performs deployment preflight, public-network enforcement, bounded collection, evidence bundling, and optional receipt signing.
- `@aicorg/evidence-playwright` remains the rendered human UI and native WebMCP adapter.

The current external baselines are [OpenAPI 3.2.0](https://spec.openapis.org/oas/v3.2.0.html), the [MCP 2026-07-28 release](https://blog.modelcontextprotocol.io/posts/2026-07-28/), and the [WebMCP draft](https://webmachinelearning.github.io/webmcp/).

## Data-only evidence plans

An evidence plan contains request/tool data and explicit projections. It cannot name a local module, shell command, JavaScript expression, or arbitrary callback. Every plan is bound to the canonical digest and ID of an authored behavior contract.

Projection expressions select from bounded adapter sources using JSON Pointers. Predicates turn observed protocol values into explicit requirement checks. Missing sources, invalid pointers, ambiguous OpenAPI operations, schema mismatches, redirects, oversized responses, and protocol mismatches fail closed.

Validate before collection:

```bash
aic validate evidence-plan ./aic-evidence-plan.json
aic validate remote-job ./aic-remote-job.json
```

## HTTP and OpenAPI

The HTTP adapter:

- keeps every request on the exact approved origin;
- rejects external OpenAPI references, callbacks, and webhooks;
- requires a unique `operationId` match when OpenAPI is used;
- resolves secrets only through an operator-provided reference map;
- redacts sensitive request headers from retained transcripts;
- rejects redirects and oversized or invalid JSON responses; and
- never retries an uncertain mutation.

OpenAPI describes the operation. It does not authorize execution. The evidence plan, application authorization, remote job, and runner operator policy remain separate controls.

## MCP

The default MCP caller sends self-contained stateless requests with `MCP-Protocol-Version`, `Mcp-Method`, and, for tool calls, `Mcp-Name`. It validates the advertised tool and its input/output schema before projecting evidence. The injected-caller API supports an operator-controlled transport without allowing the submitted job to load code.

## Remote production runner

A remote job binds:

- an exact canonical HTTPS origin on port 443;
- production environment;
- deployment ID and full application source revision;
- a deployment identity path;
- an authored contract and digest-bound plan;
- adapter and operation allowlists; and
- strict response, runtime, and identity-age limits.

Before any scenario executes, the runner resolves every DNS address, rejects non-public and special-use network space, pins approved addresses for the run, fetches the deployment identity without following redirects, and compares every expected binding.

Mutations are denied by default. A mutation runs only when the submitted job and the runner operator independently grant the exact operation and exact canary scope. A destructive operation needs an additional explicit operator grant. The CLI flags are operator grants, so omit them for read-only operation:

```bash
aic evidence run-remote ./aic-remote-job.json \
  --runner-id independent.example.runner \
  --runner-revision 0123456789abcdef0123456789abcdef01234567 \
  --out-file ./aic-evidence-bundle.json
```

An explicitly canary-scoped mutation adds:

```bash
--allow-mutation checkout.complete.domain=tenant_test_canary
```

Secret references are mapped to environment variable names by the operator, for example `--secret checkout-token=AIC_CHECKOUT_TOKEN`. Secret values are never written to the plan or transcript.

## Bundle and receipt verification

The evidence receipt binds the contract, plan, deployment identity, observation set, evidence manifest, runner software identity, request count, and timestamps. The bundle verifier recomputes those digests:

```bash
aic evidence verify ./aic-evidence-bundle.json
```

An unsigned receipt is reported as unsigned. To establish a runner signature, pin its exact Ed25519 public key and key ID:

```bash
aic evidence verify ./aic-evidence-bundle.json \
  --runner-public-key ./runner-public.pem \
  --runner-key-id sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

A signature proves control of the pinned key, not operational independence. Independence depends on who actually controls the runner, credentials, network, and signing key.
